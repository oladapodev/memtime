// ─── Trigger modes ──────────────────────────────────────────────

export type TriggerMode = "auto" | "comment" | "custom";

export type FileFilter = {
  pattern: string; // Glob pattern like "src/**/*.ts"
  action: "include" | "exclude";
};

export type CustomConfig = {
  fileFilters?: FileFilter[];
  branchFilters?: string[];    // Glob patterns like "main", "feature/*"
  labelRequirements?: string[]; // Labels that must be present
};

export type TriggerConfig = {
  id: string;
  repoId: string;
  triggerMode: TriggerMode;
  configJson: CustomConfig;
  updatedAt: string;
};

// ─── Trigger evaluation result ─────────────────────────────────

export type TriggerEvaluation = {
  shouldTrigger: boolean;
  reason: string;
  mode: TriggerMode;
};

// ─── GitHub webhook event types (simplified for evaluation) ────

export type PullRequestEvent = {
  action: string;
  repository: { full_name: string; default_branch: string };
  pull_request: {
    number: number;
    title: string;
    state: string;
    head: { sha: string; ref: string };
    base: { sha: string; ref: string };
    labels: Array<{ name: string }>;
  };
  installation?: { id: number };
};

export type IssueCommentEvent = {
  action: string;
  repository: { full_name: string };
  issue: { number: number; pull_request?: unknown };
  comment: { body: string };
  installation?: { id: number };
};
