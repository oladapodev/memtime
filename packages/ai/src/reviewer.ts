import { analyzeDiff } from "../../core/src/rules";
import type { Finding } from "../../core/src/types";
import { compressDiff } from "./compressor";
import { reduceFindings, scoreFindings } from "./suggester";
import { formatContextForPrompt } from "./context-builder";
import { callAI, createDefaultRegistry } from "./models";
import type { ReviewContext, AIReviewOutput, ModelRegistry } from "./types";

/**
 * Run an AI-powered PR review with codebase context injection.
 * 1. Compress the diff
 * 2. Build rich context from indexed codebase
 * 3. Run AI review with context injection
 * 4. Parse structured output
 * 5. Score and filter findings
 * 6. Merge with deterministic rules
 */
export async function aiReview(
  ctx: ReviewContext,
  options: {
    registry?: ModelRegistry;
    aiBinding?: { run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>> };
    env?: Record<string, string | undefined>;
  } = {},
): Promise<AIReviewOutput> {
  const registry = options.registry ?? createDefaultRegistry(options.env ?? {});
  const compressed = compressDiff(ctx.diff);
  const contextPrompt = formatContextForPrompt(ctx);

  const system = `You are ForkBot, an expert code reviewer integrated with an AI-powered code review system. Your task is to review a pull request and provide structured feedback.

Analyze the PR diff with the provided codebase context. For each issue you find, provide:
1. The file path and approximate line number
2. A severity rating: critical, high, medium, low, or info
3. A clear title for the issue
4. A detailed body explaining the risk
5. A concrete, actionable suggestion to fix it
6. A memory fact that captures this as a reusable convention

Focus on:
- Security vulnerabilities (injection, auth bypass, data leaks)
- Logic bugs and error handling issues
- Performance problems
- Code quality and maintainability 
- Missing tests or documentation
- Violations of project conventions

Be specific with file paths and line numbers. Output your findings in a structured JSON format.`;

  const prompt = `Review this pull request for ${ctx.repoId}#${ctx.prNumber}: "${ctx.prTitle}"

## Codebase Context
${contextPrompt}

## Diff Summary
${compressed.summary}

## Files Changed
${compressed.chunks.map((c) => `- ${c.filePath} (${c.changeType}, +${c.linesAdded} -${c.linesRemoved})`).join("\n")}

## Instructions
Review the diff changes thoroughly using the codebase context provided above.

Output your review as valid JSON with this exact structure:
\`\`\`json
{
  "summary": "A 1-2 sentence summary of the review",
  "findings": [
    {
      "ruleId": "ai-<short-name>",
      "severity": "critical|high|medium|low|info",
      "filePath": "relative/file/path.ts",
      "line": 42,
      "title": "Short descriptive title",
      "body": "Detailed explanation of the issue and why it matters",
      "suggestion": "Concrete actionable fix suggestion",
      "memoryFact": "Reusable convention to remember for future reviews"
    }
  ],
  "suggestions": [
    {
      "filePath": "relative/file/path.ts",
      "line": 42,
      "original": "the original code (optional)",
      "suggested": "the suggested replacement code",
      "explanation": "why this change is better",
      "confidence": 8
    }
  ]
}
\`\`\`

Rules:
- Only flag real issues you are confident about
- Each finding must reference a specific file and line
- Suggestions should be specific code changes
- If the PR looks good, return findings as an empty array
- confidence must be 1-10`;

  // Run AI
  const result = await callAI(
    prompt,
    system,
    registry,
    options.aiBinding,
  );

  // Parse structured output
  const parsed = parseReviewOutput(result.content, ctx.diff);

  // Score and filter findings
  const scoredFindings = scoreFindings(parsed.findings);
  const reducedFindings = reduceFindings(scoredFindings, ctx);

  // Merge with deterministic rules
  const deterministicFindings = analyzeDiff(ctx.diff);
  const allFindings = mergeFindings(reducedFindings, deterministicFindings);

  return {
    summary: parsed.summary,
    findings: allFindings,
    suggestions: parsed.suggestions,
    confidence: allFindings.reduce((acc, f) => acc + (f.severity === "critical" ? 3 : f.severity === "high" ? 2 : 1), 0) / allFindings.length,
    modelUsed: result.model,
  };
}

/**
 * Parse AI response into structured output.
 * Handles both pure JSON responses and markdown-wrapped JSON.
 */
function parseReviewOutput(
  content: string,
  diff: string,
): { summary: string; findings: Finding[]; suggestions: AIReviewOutput["suggestions"] } {
  let json: Partial<AIReviewOutput> = {};

  try {
    // Try to extract JSON from markdown blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch?.[1]?.trim() ?? content.trim();
    json = JSON.parse(jsonStr) as Partial<AIReviewOutput>;
  } catch {
    // If JSON parsing fails, create a fallback finding
    return {
      summary: content.slice(0, 200),
      findings: [
        {
          ruleId: "ai-parse-error",
          severity: "info",
          filePath: "review",
          line: null,
          title: "AI review response could not be parsed",
          body: "The AI returned unstructured text instead of JSON. Raw response excerpt below.",
          suggestion: "Re-run review or check the AI model availability.",
          memoryFact: "AI review parsing failed for this PR.",
        },
      ],
      suggestions: [],
    };
  }

  const findings = (json.findings ?? []).map((f) => ({
    ruleId: f.ruleId ?? "ai-finding",
    severity: (["critical", "high", "medium", "low", "info"] as const).includes(f.severity)
      ? f.severity
      : "medium",
    filePath: f.filePath ?? inferFilePath(diff),
    line: typeof f.line === "number" ? f.line : inferLine(diff),
    title: f.title ?? "AI finding",
    body: f.body ?? "",
    suggestion: f.suggestion ?? "",
    memoryFact: f.memoryFact ?? "",
  }));

  const suggestions = (json.suggestions ?? []).map((s) => ({
    filePath: s.filePath ?? inferFilePath(diff),
    line: typeof s.line === "number" ? s.line : (inferLine(diff) ?? 0),
    original: s.original ?? "",
    suggested: s.suggested ?? "",
    explanation: s.explanation ?? "",
    confidence: Math.min(10, Math.max(1, s.confidence ?? 5)),
  }));

  return {
    summary: json.summary ?? `Found ${findings.length} issue(s).`,
    findings,
    suggestions,
  };
}

function inferFilePath(diff: string): string {
  const match = diff.match(/^diff --git a\/(.+?) b\/(.+)$/m);
  return match?.[2] ?? "unknown";
}

function inferLine(diff: string): number | null {
  // Extract first line number from diff hunk header
  const match = diff.match(/^@@ -\d+(?:,\d+)? \+(\d+)/m);
  return match ? Number(match[1]) : null;
}

/**
 * Merge AI findings with deterministic rules findings.
 * Deduplicates by ruleId.
 */
function mergeFindings(aiFindings: Finding[], deterministicFindings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return [...aiFindings, ...deterministicFindings].filter((f) => {
    // Use ruleId + filePath as dedup key
    const key = `${f.ruleId}:${f.filePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
