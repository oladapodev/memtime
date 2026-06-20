import type { Finding, Severity } from "../../core/src/types";
import type { ReviewContext, CodeSuggestion } from "./types";

/**
 * Score AI findings using self-reflection (1-10 scale).
 * Low-confidence findings are downgraded or removed.
 */
export function scoreFindings(findings: Finding[]): ScoredFinding[] {
  return findings.map((f) => {
    let confidence = 7; // default

    // Boost by evidence quality
    if (f.line && f.filePath !== "unknown") confidence += 1;
    if (f.suggestion.length > 20) confidence += 1;
    if (f.memoryFact.length > 10) confidence += 1;

    // Penalize for vagueness
    if (f.body.length < 30) confidence -= 2;
    if (f.filePath === "unknown" || f.filePath === "review") confidence -= 2;
    if (!f.line) confidence -= 1;

    // Penalize for generic language
    const genericPatterns = ["consider", "might", "could", "perhaps", "maybe"];
    const lowerBody = f.body.toLowerCase();
    for (const pattern of genericPatterns) {
      if (lowerBody.includes(pattern)) confidence -= 1;
    }

    return { ...f, confidence: Math.max(1, Math.min(10, confidence)) };
  });
}

type ScoredFinding = Finding & { confidence: number };

/**
 * Reduce findings based on confidence and context.
 * - Removes findings below confidence threshold
 * - Downgrades severity for low-confidence findings
 * - Ensures at least one finding remains
 */
export function reduceFindings(
  findings: ScoredFinding[],
  ctx: ReviewContext,
): Finding[] {
  if (findings.length === 0) {
    return [
      {
        ruleId: "ai-clear-review",
        severity: "info",
        filePath: "review",
        line: null,
        title: "No issues detected by AI",
        body: "The AI review did not flag any issues in this PR based on the codebase context.",
        suggestion: "Ensure tests pass and get a human review for critical paths.",
        memoryFact: "PR passed AI review with no findings.",
      },
    ];
  }

  const result: Finding[] = [];

  for (const f of findings) {
    // Skip very low confidence findings
    if (f.confidence < 3) continue;

    // Downgrade medium/low confidence
    let severity: Severity = f.severity;
    if (f.confidence < 5 && (severity === "critical" || severity === "high")) {
      severity = "medium";
    }
    if (f.confidence < 4 && severity === "medium") {
      severity = "low";
    }

    result.push({
      ruleId: f.ruleId,
      severity,
      filePath: f.filePath,
      line: f.line,
      title: f.title,
      body: f.body,
      suggestion: f.suggestion,
      memoryFact: f.memoryFact,
    });
  }

  // If everything was filtered out, keep the highest confidence one
  if (result.length === 0 && findings.length > 0) {
    const best = findings.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    result.push({
      ruleId: best.ruleId,
      severity: "low",
      filePath: best.filePath,
      line: best.line,
      title: best.title,
      body: best.body,
      suggestion: best.suggestion,
      memoryFact: best.memoryFact,
    });
  }

  return result;
}

/**
 * Format inline code suggestions as committable comments.
 */
export function formatSuggestions(suggestions: CodeSuggestion[]): string {
  if (suggestions.length === 0) return "";

  const blocks = suggestions.map(
    (s, i) =>
      `### Suggestion #${i + 1}: ${s.filePath}:${s.line}\n\n` +
      `${s.explanation}\n\n` +
      `**Confidence:** ${s.confidence}/10\n\n` +
      (s.original ? `**Original:**\n\`\`\`\n${s.original}\n\`\`\`\n\n` : "") +
      `**Suggested:**\n\`\`\`\n${s.suggested}\n\`\`\`\n`,
  );

  return `## ForkBot Inline Suggestions\n\n${blocks.join("\n\n---\n\n")}`;
}
