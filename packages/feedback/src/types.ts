// ─── Feedback types ──────────────────────────────────────────────

export type FeedbackType = "helpful" | "false_positive" | "not_useful";

export type FindingFeedback = {
  id: string;
  findingId: string;
  runId: string;
  ruleId: string;
  feedbackType: FeedbackType;
  comment?: string;
  createdAt: string;
};

export type RuleHealth = {
  ruleId: string;
  totalFindings: number;
  falsePositiveCount: number;
  helpfulCount: number;
  falsePositiveRate: number;
  currentSeverity: string;
  autoSuppressed: boolean;
  lastEvaluated?: string;
  updatedAt: string;
};

export type FeedbackSubmission = {
  findingId: string;
  runId: string;
  ruleId: string;
  feedbackType: FeedbackType;
  comment?: string;
};

export type AdjustmentAction = {
  ruleId: string;
  action: "suppress" | "downgrade" | "notify" | "none";
  reason: string;
  recommendedSeverity?: string;
};

export type FeedbackStats = {
  totalFeedback: number;
  totalFalsePositives: number;
  falsePositiveRate: number;
  health: RuleHealth[];
  adjustments: AdjustmentAction[];
};
