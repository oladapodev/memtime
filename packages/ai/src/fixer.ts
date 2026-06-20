import type { Finding } from "../../core/src/types";
import { callAI, createDefaultRegistry } from "./models";
import type { FixResult, ModelRegistry } from "./types";

/**
 * Generate a fix patch for a specific finding.
 * Uses the finding details + current code context to produce a targeted fix.
 */
export async function generateFix(
  finding: Finding,
  codeContext: string,
  options: {
    registry?: ModelRegistry;
    aiBinding?: { run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>> };
    env?: Record<string, string | undefined>;
  } = {},
): Promise<FixResult> {
  const registry = options.registry ?? createDefaultRegistry(options.env ?? {});

  const system = `You are ForkBot Fix, an expert at generating precise code fixes.
Given a code review finding and the surrounding code context, generate a git diff patch that fixes the issue.

Rules:
- Output only a valid unified diff patch
- Include the exact file paths from the code context
- The patch must apply cleanly with \`git apply\`
- Only fix the specific issue described in the finding
- Do not make unrelated changes
- Format as a proper git diff`;

  const prompt = `Generate a fix for this code review finding:

## Finding
- **Title:** ${finding.title}
- **Severity:** ${finding.severity}
- **File:** ${finding.filePath}${finding.line ? `:${finding.line}` : ""}
- **Description:** ${finding.body}
- **Suggested fix:** ${finding.suggestion}
- **Memory fact:** ${finding.memoryFact}

## Current Code Context
\`\`\`
${codeContext.slice(0, 4000)}
\`\`\`

## Fix Instructions
Generate a unified diff patch (git diff format) that fixes the issue described above.
The patch should be minimal and targeted to the specific problem.

Output:
\`\`\`diff
--- a/${finding.filePath}
+++ b/${finding.filePath}
@@ -1,3 +1,4 @@
 ... patch content ...
\`\`\`

If you cannot generate a fix with confidence, return: {"error": "reason"}`;

  try {
    const result = await callAI(
      prompt,
      system,
      registry,
      options.aiBinding,
    );

    // Parse the patch
    const patch = extractPatch(result.content);

    if (!patch) {
      return {
        patch: "",
        explanation: "Could not generate a fix patch from the AI response.",
        confidence: 0,
        verified: false,
      };
    }

    return {
      patch,
      explanation: finding.suggestion,
      confidence: estimatePatchConfidence(patch, finding),
      verified: false,
    };
  } catch (error) {
    return {
      patch: "",
      explanation: error instanceof Error ? error.message : String(error),
      confidence: 0,
      verified: false,
    };
  }
}

/**
 * Extract a git diff patch from AI response text.
 */
function extractPatch(text: string): string {
  // Try to extract from markdown code block
  const diffBlock = text.match(/```diff\s*([\s\S]*?)```/);
  if (diffBlock?.[1]?.trim()) return diffBlock[1].trim();

  // Try to extract raw diff (lines starting with ---, +++)
  const lines = text.split("\n");
  const diffStart = lines.findIndex(
    (l) => l.startsWith("--- ") || l.startsWith("diff --git"),
  );
  if (diffStart >= 0) {
    return lines.slice(diffStart).join("\n").trim();
  }

  return "";
}

/**
 * Estimate the confidence of a generated patch.
 * Higher if it has proper diff structure, references the right file, and has hunks.
 */
function estimatePatchConfidence(patch: string, finding: Finding): number {
  let confidence = 5;

  if (patch.startsWith("---") || patch.startsWith("diff --git")) confidence += 1;
  if (patch.includes(`+++ b/${finding.filePath}`)) confidence += 1;
  if (patch.includes("@@")) confidence += 1;
  if (patch.includes("\n+") || patch.includes("\n-")) confidence += 1;

  // Length penalty: too short or too long
  const lines = patch.split("\n").length;
  if (lines > 3 && lines < 100) confidence += 1;
  if (lines < 3) confidence -= 2;

  return Math.max(1, Math.min(10, confidence));
}
