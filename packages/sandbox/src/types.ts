import type { Finding } from "../../core/src/types";

/** Result from the fix pipeline (AI generation + sandbox verification) */
export type FixPipelineResult = {
  id: string;
  runId: string;
  finding: Finding;
  patch: string;
  explanation: string;
  confidence: number;
  verified: boolean;
  sandboxLog: string;
  applied: boolean;
  createdAt: string;
};

/** Input for triggering a fix */
export type FixRequest = {
  runId: string;
  finding: Finding;
  codeContext: string;
};

/** Sandbox SDK abstraction for code verification */
export interface FixVerifier {
  readonly name: string;
  /** Verify a fix patch by attempting to apply it and run checks */
  verify(patch: string, finding: Finding): Promise<VerificationResult>;
  /** Check if the sandbox is available */
  isAvailable(): boolean;
}

/** Result from sandbox verification */
export type VerificationResult = {
  passed: boolean;
  log: string;
  confidence: number;
};

/** Configuration for the sandbox verifier */
export type SandboxConfig = {
  /** Sandbox SDK Durable Object binding */
  sandbox?: {
    exec: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    writeFile: (path: string, content: string) => Promise<void>;
    readFile: (path: string) => Promise<string>;
  };
};
