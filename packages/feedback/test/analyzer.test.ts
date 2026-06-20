import { describe, expect, test } from "bun:test";
import { analyzeRuleHealth, analyzeAllRules, updateRuleHealth } from "../src/analyzer";
import type { RuleHealth } from "../src/types";

describe("updateRuleHealth", () => {
  test("creates new health record when none exists", () => {
    const result = updateRuleHealth(null, "test-rule", "false_positive", "high");
    expect(result.ruleId).toBe("test-rule");
    expect(result.totalFindings).toBe(1);
    expect(result.falsePositiveCount).toBe(1);
    expect(result.falsePositiveRate).toBe(1);
    expect(result.currentSeverity).toBe("high");
  });

  test("increments on helpful feedback", () => {
    const existing: RuleHealth = {
      ruleId: "test-rule",
      totalFindings: 5,
      falsePositiveCount: 1,
      helpfulCount: 3,
      falsePositiveRate: 0.2,
      currentSeverity: "medium",
      autoSuppressed: false,
      updatedAt: new Date().toISOString(),
    };

    const result = updateRuleHealth(existing, "test-rule", "helpful");
    expect(result.totalFindings).toBe(6);
    expect(result.helpfulCount).toBe(4);
    expect(result.falsePositiveCount).toBe(1);
    expect(result.falsePositiveRate).toBeCloseTo(1 / 6, 5);
  });

  test("increments on false_positive feedback", () => {
    const existing: RuleHealth = {
      ruleId: "test-rule",
      totalFindings: 4,
      falsePositiveCount: 1,
      helpfulCount: 2,
      falsePositiveRate: 0.25,
      currentSeverity: "medium",
      autoSuppressed: false,
      updatedAt: new Date().toISOString(),
    };

    const result = updateRuleHealth(existing, "test-rule", "false_positive");
    expect(result.totalFindings).toBe(5);
    expect(result.falsePositiveCount).toBe(2);
    expect(result.falsePositiveRate).toBeCloseTo(0.4, 5);
  });

  test("maintains state on not_useful feedback", () => {
    const existing: RuleHealth = {
      ruleId: "test-rule",
      totalFindings: 3,
      falsePositiveCount: 1,
      helpfulCount: 1,
      falsePositiveRate: 1 / 3,
      currentSeverity: "low",
      autoSuppressed: false,
      updatedAt: new Date().toISOString(),
    };

    const result = updateRuleHealth(existing, "test-rule", "not_useful");
    expect(result.totalFindings).toBe(4);
    expect(result.falsePositiveCount).toBe(1);
    expect(result.helpfulCount).toBe(1);
  });
});

describe("analyzeRuleHealth", () => {
  test("suppresses rule when FP rate >= 60%", () => {
    const health: RuleHealth = {
      ruleId: "noisy-rule",
      totalFindings: 10,
      falsePositiveCount: 7,
      helpfulCount: 1,
      falsePositiveRate: 0.7,
      currentSeverity: "high",
      autoSuppressed: false,
      updatedAt: new Date().toISOString(),
    };

    const action = analyzeRuleHealth(health);
    expect(action.action).toBe("suppress");
    expect(action.ruleId).toBe("noisy-rule");
  });

  test("downgrades rule when FP rate >= 30%", () => {
    const health: RuleHealth = {
      ruleId: "slightly-noisy",
      totalFindings: 10,
      falsePositiveCount: 4,
      helpfulCount: 4,
      falsePositiveRate: 0.4,
      currentSeverity: "high",
      autoSuppressed: false,
      updatedAt: new Date().toISOString(),
    };

    const action = analyzeRuleHealth(health);
    expect(action.action).toBe("downgrade");
    expect(action.recommendedSeverity).toBe("medium");
  });

  test("no action when FP rate is low", () => {
    const health: RuleHealth = {
      ruleId: "good-rule",
      totalFindings: 20,
      falsePositiveCount: 2,
      helpfulCount: 15,
      falsePositiveRate: 0.1,
      currentSeverity: "high",
      autoSuppressed: false,
      updatedAt: new Date().toISOString(),
    };

    const action = analyzeRuleHealth(health);
    expect(action.action).toBe("none");
  });

  test("no action when not enough data", () => {
    const health: RuleHealth = {
      ruleId: "new-rule",
      totalFindings: 1,
      falsePositiveCount: 1,
      helpfulCount: 0,
      falsePositiveRate: 1,
      currentSeverity: "medium",
      autoSuppressed: false,
      updatedAt: new Date().toISOString(),
    };

    const action = analyzeRuleHealth(health);
    expect(action.action).toBe("none");
    expect(action.reason).toContain("at least 3");
  });
});

describe("analyzeAllRules", () => {
  test("analyzes multiple rules and returns sorted actions", () => {
    const records: RuleHealth[] = [
      {
        ruleId: "noisy-rule",
        totalFindings: 10,
        falsePositiveCount: 7,
        helpfulCount: 1,
        falsePositiveRate: 0.7,
        currentSeverity: "high",
        autoSuppressed: false,
        updatedAt: new Date().toISOString(),
      },
      {
        ruleId: "good-rule",
        totalFindings: 20,
        falsePositiveCount: 2,
        helpfulCount: 15,
        falsePositiveRate: 0.1,
        currentSeverity: "high",
        autoSuppressed: false,
        updatedAt: new Date().toISOString(),
      },
    ];

    const actions = analyzeAllRules(records);
    expect(actions).toHaveLength(2);

    const noisy = actions.find((a) => a.ruleId === "noisy-rule");
    expect(noisy?.action).toBe("suppress");

    const good = actions.find((a) => a.ruleId === "good-rule");
    expect(good?.action).toBe("none");
  });
});
