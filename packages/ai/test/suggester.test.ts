import { describe, expect, test } from "bun:test";
import { scoreFindings, reduceFindings, formatSuggestions } from "../src/suggester";
import type { ReviewContext, CodeSuggestion } from "../src/types";

describe("scoreFindings", () => {
  test("scores findings with confidence 1-10", () => {
    const findings = [
      {
        ruleId: "test-1",
        severity: "high" as const,
        filePath: "src/auth.ts",
        line: 42,
        title: "Test finding",
        body: "This is a detailed body with enough context to be meaningful for evaluation.",
        suggestion: "Add a check for the revoked token before using the cache value",
        memoryFact: "Auth caches must include revocation checks.",
      },
    ];
    const scored = scoreFindings(findings);
    expect(scored[0].confidence).toBeGreaterThanOrEqual(1);
    expect(scored[0].confidence).toBeLessThanOrEqual(10);
    // Detailed findings should score higher
    expect(scored[0].confidence).toBeGreaterThan(5);
  });

  test("penalizes vague findings", () => {
    const findings = [
      {
        ruleId: "test-2",
        severity: "medium" as const,
        filePath: "unknown",
        line: null,
        title: "Vague",
        body: "Consider improving this.",
        suggestion: "",
        memoryFact: "",
      },
    ];
    const scored = scoreFindings(findings);
    expect(scored[0].confidence).toBeLessThan(5);
  });
});

describe("reduceFindings", () => {
  const ctx = {
    repoId: "test/repo",
    prNumber: 1,
    prTitle: "Test PR",
    architectureDocs: "",
    conventions: "",
    relevantChunks: [],
    memoryFacts: [],
    diff: "",
    commitMessages: [],
  };

  test("returns info finding when no issues detected", () => {
    const result = reduceFindings([], ctx);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("ai-clear-review");
  });

  test("keeps at least one finding when all are low confidence", () => {
    const scored = scoreFindings([
      {
        ruleId: "low-confidence",
        severity: "high" as const,
        filePath: "src/test.ts",
        line: 5,
        title: "Low confidence",
        body: "This body is detailed enough to be meaningful and avoid the vague penalty.",
        suggestion: "A specific actionable suggestion for the developer to implement.",
        memoryFact: "A reusable convention memory fact for future reviews.",
      },
    ]);
    // Override confidence to low to test the filter
    const lowConfidence = scored.map((f) => ({ ...f, confidence: 2 }));
    const result = reduceFindings(lowConfidence, ctx);
    // reduceFindings always returns at least one finding (the best one, downgraded)
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("low");
  });
});

describe("formatSuggestions", () => {
  test("returns empty string for no suggestions", () => {
    expect(formatSuggestions([])).toBe("");
  });

  test("formats suggestions with markdown", () => {
    const suggestions: CodeSuggestion[] = [
      {
        filePath: "src/auth.ts",
        line: 42,
        original: "old code",
        suggested: "new code",
        explanation: "Fix the bug",
        confidence: 8,
      },
    ];
    const result = formatSuggestions(suggestions);
    expect(result).toContain("src/auth.ts:42");
    expect(result).toContain("new code");
    expect(result).toContain("8/10");
  });
});
