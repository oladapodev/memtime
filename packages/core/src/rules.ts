import type { Finding } from "./types";

type Rule = {
  id: string;
  match: (diff: string) => boolean;
  finding: Omit<Finding, "ruleId">;
};

const rules: Rule[] = [
  {
    id: "auth-cache-revocation",
    match: (diff) => /cache\.get\([^)]*session|ttl:\s*86400|ttl\s*=\s*86400/i.test(diff) && /auth\.verify|verify\(token/i.test(diff),
    finding: {
      severity: "high",
      filePath: "src/middleware.ts",
      line: null,
      title: "Cached auth can bypass revocation",
      body: "Session data is trusted from cache before revocation is checked. A revoked token can remain valid until the cache expires.",
      suggestion: "Include token version or revocation epoch in the cache key, or verify revocation before returning from cache.",
      memoryFact: "Auth cache entries must include token version or revocation epoch before they can be trusted.",
    },
  },
  {
    id: "formdata-mass-assignment",
    match: (diff) => /Object\.fromEntries\(formData\)|Object\.fromEntries\(/.test(diff) && /db\.\w+\.update|\.update\(\{/.test(diff),
    finding: {
      severity: "high",
      filePath: "src/server/actions/profile.ts",
      line: null,
      title: "Unvalidated form data reaches database update",
      body: "Raw submitted fields are passed into an update call, allowing unexpected fields to mutate protected columns.",
      suggestion: "Parse form data with a schema and pass only allowlisted fields into the update.",
      memoryFact: "Server actions must schema-parse form data before database writes.",
    },
  },
  {
    id: "secret-logging",
    match: (diff) => /console\.(log|debug|info)\([^)]*(token|secret|password|api[_-]?key)/i.test(diff),
    finding: {
      severity: "critical",
      filePath: "unknown",
      line: null,
      title: "Secret may be logged",
      body: "Sensitive credential material appears in logging code.",
      suggestion: "Remove the log or redact the value before emitting telemetry.",
      memoryFact: "Review must block logging of tokens, passwords, API keys, or secrets.",
    },
  },
  {
    id: "cloudflare-process-env",
    match: (diff) => /process\.env\./.test(diff) && /worker|cloudflare|wrangler/i.test(diff),
    finding: {
      severity: "medium",
      filePath: "worker",
      line: null,
      title: "Cloudflare Worker should use env bindings",
      body: "Worker runtime configuration should come from bindings passed to handlers, not Node process globals.",
      suggestion: "Read secrets and config from Worker `env` bindings.",
      memoryFact: "Cloudflare Worker code must use env bindings for runtime configuration.",
    },
  },
  {
    id: "missing-test-signal",
    match: (diff) => !/(test|spec|__tests__|bun:test|vitest|jest)/i.test(diff),
    finding: {
      severity: "low",
      filePath: "tests",
      line: null,
      title: "No test change detected",
      body: "The diff changes behavior but does not appear to add or update tests.",
      suggestion: "Add focused tests for the changed behavior or explain why existing coverage is sufficient.",
      memoryFact: "Behavior-changing PRs should include focused tests or a clear coverage note.",
    },
  },
];

export function analyzeDiff(diff: string, suppressedRuleIds?: string[]): Finding[] {
  const activeRules = suppressedRuleIds?.length
    ? rules.filter((rule) => !suppressedRuleIds.includes(rule.id))
    : rules;

  const findings = activeRules
    .filter((rule) => rule.match(diff))
    .map((rule) => ({
      ruleId: rule.id,
      ...rule.finding,
      filePath: inferFilePath(diff, rule.finding.filePath),
      line: inferLine(diff, rule.finding.filePath),
    }));

  if (findings.length > 0) return findings;

  return [
    {
      ruleId: "no-rule-hit",
      severity: "info",
      filePath: "review",
      line: null,
      title: "No high-confidence rule matched",
      body: "ForkBot still created isolated PR memory so findings and rejected hypotheses stay auditable.",
      suggestion: "Use optional AI review or promote any verified convention manually.",
      memoryFact: "PR reviewed with no deterministic rule hit.",
    },
  ];
}

function inferFilePath(diff: string, fallback: string): string {
  if (diff.includes(` b/${fallback}`) || diff.includes(` a/${fallback}`)) return fallback;
  const match = diff.match(/^diff --git a\/(.+?) b\/(.+)$/m);
  return match?.[2] ?? fallback;
}

function inferLine(diff: string, _fallbackPath: string): number | null {
  const match = diff.match(/^@@ -\d+(?:,\d+)? \+(\d+)/m);
  return match ? Number(match[1]) : null;
}
