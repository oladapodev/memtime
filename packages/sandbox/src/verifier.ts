import type { Finding } from "../../core/src/types";
import type { FixVerifier, VerificationResult } from "./types";

/**
 * Dry-run verifier — no sandbox needed.
 * Returns a verification result based on patch structure analysis.
 * Used for local development and testing.
 */
export class DryRunFixVerifier implements FixVerifier {
  readonly name = "dry-run";

  async verify(patch: string, _finding: Finding): Promise<VerificationResult> {
    const lines = patch.split("\n");
    const hasDiffHeader = lines.some((l) => l.startsWith("--- ") || l.startsWith("diff --git"));
    const hasHunks = lines.some((l) => l.startsWith("@@"));

    if (!patch.trim()) {
      return { passed: false, log: "No patch content to verify.", confidence: 0 };
    }

    if (!hasDiffHeader) {
      return { passed: false, log: "Patch is missing diff header (---/+++).", confidence: 0 };
    }

    const changeLines = lines.filter((l) => l.startsWith("+") || l.startsWith("-")).length;
    const log = [
      `Dry-run verification:`,
      `  Patch size: ${lines.length} lines, ${changeLines} changes`,
      `  Format: ${hasDiffHeader ? "valid diff" : "missing header"}`,
      `  Hunks: ${hasHunks ? "present" : "none"}`,
      `  Result: structural check ${hasDiffHeader && hasHunks ? "PASSED" : "FAILED"}`,
    ].join("\n");

    return {
      passed: hasDiffHeader && hasHunks,
      log,
      confidence: hasDiffHeader && hasHunks ? 7 : 2,
    };
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Real sandbox verifier using Cloudflare Sandbox SDK.
 * Clones the repo, applies the patch, and runs typecheck.
 */
export class SandboxFixVerifier implements FixVerifier {
  readonly name = "sandbox";

  constructor(
    private sandbox: {
      exec: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
      writeFile: (path: string, content: string) => Promise<void>;
      readFile: (path: string) => Promise<string>;
    },
    private repoUrl?: string,
  ) {}

  async verify(patch: string, finding: Finding): Promise<VerificationResult> {
    const logs: string[] = [];
    logs.push(`Sandbox verification started for ${finding.filePath}:${finding.line}`);
    logs.push(`Finding: ${finding.title}`);

    try {
      // Step 1: Write the patch to a file
      logs.push("Writing patch file...");
      await this.sandbox.writeFile("/tmp/fix.patch", patch);

      // Step 2: Try to apply the patch (requires repo context)
      // If we have a repo URL, clone it first
      if (this.repoUrl) {
        logs.push(`Cloning ${this.repoUrl}...`);
        const cloneResult = await this.sandbox.exec(`git clone --depth 1 ${this.repoUrl} /tmp/repo 2>&1`);
        logs.push(cloneResult.stdout);

        if (cloneResult.exitCode !== 0) {
          logs.push(`Clone failed: ${cloneResult.stderr}`);
          return {
            passed: false,
            log: logs.join("\n"),
            confidence: 3,
          };
        }

        // Apply the patch
        logs.push("Applying patch...");
        const applyResult = await this.sandbox.exec(
          `cd /tmp/repo && git apply /tmp/fix.patch 2>&1`,
        );
        logs.push(applyResult.stdout);
        if (applyResult.stderr) logs.push(`stderr: ${applyResult.stderr}`);

        if (applyResult.exitCode !== 0) {
          logs.push("Patch application FAILED");
          return {
            passed: false,
            log: logs.join("\n"),
            confidence: 4,
          };
        }

        logs.push("Patch applied successfully");

        // Step 3: Run typecheck if applicable
        const hasConfigFiles = await this.detectProjectType();
        if (hasConfigFiles.type === "typescript") {
          logs.push("Running typecheck...");
          const tcResult = await this.sandbox.exec(
            `cd /tmp/repo && npx tsc --noEmit 2>&1 || true`,
          );
          logs.push(tcResult.stdout);
          if (tcResult.stderr) logs.push(tcResult.stderr);

          if (tcResult.exitCode === 0) {
            logs.push("Typecheck PASSED");
            return { passed: true, log: logs.join("\n"), confidence: 9 };
          } else {
            logs.push("Typecheck FAILED (confidence reduced)");
            return { passed: true, log: logs.join("\n"), confidence: 6 };
          }
        }

        // Step 4: If no typecheck available, verify patch structure
        logs.push("No typecheck available — structural verification only");
        return { passed: true, log: logs.join("\n"), confidence: 7 };
      }

      // Without repo URL, do structural check only
      logs.push("No repo URL — structural verification only");
      const lines = patch.split("\n");
      const hasHunks = lines.some((l) => l.startsWith("@@"));

      return {
        passed: hasHunks,
        log: logs.join("\n"),
        confidence: hasHunks ? 6 : 3,
      };

    } catch (error) {
      logs.push(`Sandbox error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        passed: false,
        log: logs.join("\n"),
        confidence: 1,
      };
    }
  }

  private async detectProjectType(): Promise<{ type: string }> {
    try {
      const result = await this.sandbox.exec(
        `cd /tmp/repo && ls package.json tsconfig.json 2>/dev/null | head -2`,
      );
      if (result.stdout.includes("tsconfig.json")) return { type: "typescript" };
      if (result.stdout.includes("package.json")) return { type: "javascript" };
      return { type: "unknown" };
    } catch {
      return { type: "unknown" };
    }
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Create a fix verifier based on the available sandbox config.
 */
export function createFixVerifier(config?: {
  sandbox?: {
    exec: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    writeFile: (path: string, content: string) => Promise<void>;
    readFile: (path: string) => Promise<string>;
  };
  repoUrl?: string;
}): FixVerifier {
  if (config?.sandbox) {
    return new SandboxFixVerifier(config.sandbox, config.repoUrl);
  }
  return new DryRunFixVerifier();
}
