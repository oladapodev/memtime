import type { Finding } from "../../core/src/types";

/** Configuration for an AI model */
export type ModelConfig = {
  provider: "workers-ai" | "openai" | "anthropic";
  model: string;
  apiKey?: string;
  baseUrl?: string;
};

/** Model registry with fallback chain */
export type ModelRegistry = {
  primary: ModelConfig;
  fallbacks: ModelConfig[];
};

/** An inline code suggestion for a specific location */
export type CodeSuggestion = {
  filePath: string;
  line: number;
  original: string;
  suggested: string;
  explanation: string;
  confidence: number; // 0-10 self-reflection score
};

/** Result from the compress stage */
export type CompressedDiff = {
  chunks: DiffChunk[];
  tokenEstimate: number;
  summary: string;
};

/** A single chunk of a compressed diff */
export type DiffChunk = {
  filePath: string;
  hunks: string;
  changeType: "added" | "modified" | "deleted" | "renamed";
  linesAdded: number;
  linesRemoved: number;
};

/** Rich context for AI review */
export type ReviewContext = {
  repoId: string;
  prNumber: number;
  prTitle: string;
  /** Codebase architecture docs from indexed repo */
  architectureDocs: string;
  /** Code conventions from indexed repo */
  conventions: string;
  /** Relevant code chunks from vector search */
  relevantChunks: Array<{ filePath: string; content: string; score: number }>;
  /** Trusted memory facts from MemForks */
  memoryFacts: string[];
  /** The compressed diff */
  diff: string;
  /** Commit history context */
  commitMessages: string[];
};

/** Structured AI review output */
export type AIReviewOutput = {
  summary: string;
  findings: Finding[];
  suggestions: CodeSuggestion[];
  confidence: number;
  modelUsed: string;
};

/** Fix generation result */
export type FixResult = {
  patch: string;
  explanation: string;
  confidence: number;
  verified: boolean;
  sandboxLog?: string;
};
