export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type ReviewRequest = {
  repo: string;
  prNumber: number;
  title?: string;
  diff: string;
  headSha?: string;
  baseSha?: string;
  suppressedRuleIds?: string[];
};

export type Finding = {
  ruleId: string;
  severity: Severity;
  filePath: string;
  line: number | null;
  title: string;
  body: string;
  suggestion: string;
  memoryFact: string;
};

export type MemoryEvent = {
  kind: "branch" | "recall" | "commit" | "promote" | "merge_proposal";
  branch: string;
  detail: string;
  ok: boolean;
  txId?: string;
  blobId?: string;
};

export type ReviewResult = {
  repo: string;
  prNumber: number;
  mainBranch: string;
  prBranch: string;
  summary: string;
  findings: Finding[];
  mergeableFacts: string[];
  memoryEvents: MemoryEvent[];
  markdown: string;
  status: "success" | "neutral" | "failure";
};

export type MemoryAdapter = {
  branch(name: string, from: string): Promise<MemoryEvent>;
  recall(query: string, branch: string): Promise<string[]>;
  commit(branch: string, message: string, facts: string[]): Promise<MemoryEvent>;
  promote(from: string, into: string, facts: string[]): Promise<MemoryEvent>;
};

export type RunRecord = {
  id: string;
  repo: string;
  prNumber: number;
  status: "queued" | "running" | "completed" | "failed";
  prBranch: string;
  summary: string | null;
  createdAt: string;
  completedAt: string | null;
};
