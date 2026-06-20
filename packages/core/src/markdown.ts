import type { ReviewResult } from "./types";

export function renderReviewMarkdown(result: Omit<ReviewResult, "markdown">): string {
  const findings = result.findings
    .map(
      (finding) => `### ${finding.severity.toUpperCase()}: ${finding.title}

- File: \`${finding.filePath}${finding.line ? `:${finding.line}` : ""}\`
- Risk: ${finding.body}
- Fix: ${finding.suggestion}
- Memory fact: ${finding.memoryFact}`,
    )
    .join("\n\n");

  const events = result.memoryEvents
    .map((event) => `- ${event.ok ? "OK" : "FAIL"} ${event.kind} \`${event.branch}\`: ${event.detail}`)
    .join("\n");

  return `## ForkBot PR Memory Review

${result.summary}

MemForks branch: \`${result.prBranch}\` forked from \`${result.mainBranch}\`

${findings}

### Mergeable conventions

${result.mergeableFacts.map((fact) => `- ${fact}`).join("\n")}

### MemForks evidence

${events}

Maintainer action: promote verified conventions from the dashboard or run \`forkbot promote --repo ${result.repo} --pr ${result.prNumber} --fact "..."\`.`;
}
