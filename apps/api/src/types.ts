import type { D1DatabaseLike } from "./storage";

// ─── Queue job types ────────────────────────────────────────────────
// Single queue with type discriminator to avoid multiple consumer issues

export type ReviewJob = {
  type: "review";
  runId: string;
  repo: string;
  prNumber: number;
  installationId: number;
  trigger: "webhook" | "comment_tag";
};

export type IndexJob = {
  type: "index";
  repoId: string;
  repoUrl: string;
  defaultBranch: string;
  installationId: number;
};

export type QueueJob = ReviewJob | IndexJob;

export type CommentCommand = {
  command: "review" | "fix" | "describe" | "ask" | "promote" | "status" | "help";
  args: string[];
  findingNumber?: number;
  question?: string;
  facts?: string[];
};

export type Env = Record<string, string | undefined> & {
  DB: D1DatabaseLike;
  QUEUE: { send(message: QueueJob): Promise<void> };
  AI?: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  VECTOR_INDEX?: {
    upsert: (vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>) => Promise<unknown>;
    query: (
      vector: number[],
      options: { topK: number; returnMetadata: boolean },
    ) => Promise<{ matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> }>;
  };
  ASSETS?: { fetch(request: Request): Promise<Response> };
};
