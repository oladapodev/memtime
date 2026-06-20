import type { RuleHealth, AdjustmentAction } from "./types";

// ─── Thresholds for auto-adjustment ─────────────────────────────

const FP_RATE_SUPPRESS = 0.6;  // ≥60% false positive → auto-suppress
const FP_RATE_DOWNGRADE = 0.3; // ≥30% false positive → downgrade severity

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

function severityIndex(severity: string): number {
  return SEVERITY_ORDER.indexOf(severity as (typeof SEVERITY_ORDER)[number]);
}

function downgradeSeverity(severity: string): string {
  const idx = severityIndex(severity);
  if (idx < 0 || idx >= SEVERITY_ORDER.length - 1) return severity;
  return SEVERITY_ORDER[idx + 1];
}

/**
 * Analyze a rule's health and return an adjustment action.
 */
export function analyzeRuleHealth(health: RuleHealth): AdjustmentAction {
  if (health.totalFindings < 3) {
    // Not enough data → recommend none
    return {
      ruleId: health.ruleId,
      action: "none",
      reason: `Only ${health.totalFindings} finding(s) — need at least 3 for reliable analysis.`,
    };
  }

  if (health.falsePositiveRate >= FP_RATE_SUPPRESS) {
    return {
      ruleId: health.ruleId,
      action: "suppress",
      reason: `False positive rate ${(health.falsePositiveRate * 100).toFixed(0)}% exceeds ${FP_RATE_SUPPRESS * 100}% threshold. Auto-suppressing this rule.`,
    };
  }

  if (health.falsePositiveRate >= FP_RATE_DOWNGRADE) {
    const current = health.currentSeverity;
    const downgraded = downgradeSeverity(current);
    return {
      ruleId: health.ruleId,
      action: "downgrade",
      recommendedSeverity: downgraded,
      reason: `False positive rate ${(health.falsePositiveRate * 100).toFixed(0)}% exceeds ${FP_RATE_DOWNGRADE * 100}% threshold. Recommend downgrading from ${current} to ${downgraded}.`,
    };
  }

  return {
    ruleId: health.ruleId,
    action: "none",
    reason: `False positive rate ${(health.falsePositiveRate * 100).toFixed(0)}% is within acceptable range. No action needed.`,
  };
}

/**
 * Analyze multiple rule health records and return adjustment recommendations.
 */
export function analyzeAllRules(healthRecords: RuleHealth[]): AdjustmentAction[] {
  return healthRecords.map(analyzeRuleHealth);
}

/**
 * Update rule health after receiving new feedback.
 */
export function updateRuleHealth(
  current: RuleHealth | null,
  ruleId: string,
  feedbackType: "helpful" | "false_positive" | "not_useful",
  currentSeverity?: string,
): RuleHealth {
  const base = current ?? {
    ruleId,
    totalFindings: 0,
    falsePositiveCount: 0,
    helpfulCount: 0,
    falsePositiveRate: 0,
    currentSeverity: currentSeverity ?? "medium",
    autoSuppressed: false,
    updatedAt: new Date().toISOString(),
  };

  const updated = {
    ...base,
    totalFindings: base.totalFindings + 1,
    falsePositiveCount:
      feedbackType === "false_positive"
        ? base.falsePositiveCount + 1
        : base.falsePositiveCount,
    helpfulCount:
      feedbackType === "helpful"
        ? base.helpfulCount + 1
        : base.helpfulCount,
    lastEvaluated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Recalculate rate
  updated.falsePositiveRate = updated.totalFindings > 0
    ? updated.falsePositiveCount / updated.totalFindings
    : 0;

  return updated;
}
