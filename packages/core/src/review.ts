import { prBranchName } from "./branch";
import { renderReviewMarkdown } from "./markdown";
import { analyzeDiff } from "./rules";
import type { MemoryAdapter, ReviewRequest, ReviewResult } from "./types";

const MAIN_BRANCH = "main";
const TRUSTED_FACTS = [
  "Auth-sensitive caches must include revocation-aware versioning.",
  "Server actions must validate and allowlist mutation inputs.",
  "PR reviews must include risk, impact, fix, and memory provenance.",
];

export async function reviewPullRequest(request: ReviewRequest, memory: MemoryAdapter): Promise<ReviewResult> {
  const prBranch = prBranchName(request.repo, request.prNumber);
  const memoryEvents = [];

  memoryEvents.push(await memory.branch(prBranch, MAIN_BRANCH));
  memoryEvents.push(await memory.commit(MAIN_BRANCH, "seed trusted review conventions", TRUSTED_FACTS));

  const recalled = await memory.recall("auth cache form data tests secrets worker", MAIN_BRANCH);
  memoryEvents.push({
    kind: "recall" as const,
    branch: MAIN_BRANCH,
    detail: `${recalled.length} trusted convention(s) recalled`,
    ok: true,
  });

  const findings = analyzeDiff(request.diff, request.suppressedRuleIds);
  const facts = [
    `PR ${request.repo}#${request.prNumber} reviewed on isolated branch ${prBranch}.`,
    ...findings.map((finding) => `${finding.severity}: ${finding.title}. ${finding.memoryFact}`),
  ];
  memoryEvents.push(await memory.commit(prBranch, `review ${request.repo}#${request.prNumber}`, facts));

  const mergeableFacts = [...new Set(findings.map((finding) => finding.memoryFact))];
  const blocking = findings.filter((finding) => finding.severity === "critical" || finding.severity === "high").length;
  const status = blocking > 0 ? "failure" : findings.some((finding) => finding.severity === "medium") ? "neutral" : "success";
  const summary = `Found ${findings.length} finding(s), including ${blocking} blocking issue(s). PR-specific memory stayed on \`${prBranch}\`; only approved conventions should merge to \`${MAIN_BRANCH}\`.`;
  const partial = {
    repo: request.repo,
    prNumber: request.prNumber,
    mainBranch: MAIN_BRANCH,
    prBranch,
    summary,
    findings,
    mergeableFacts,
    memoryEvents,
    status,
  };

  return {
    ...partial,
    markdown: renderReviewMarkdown(partial),
  };
}

export async function promoteFacts(repo: string, prNumber: number, facts: string[], memory: MemoryAdapter) {
  return memory.promote(prBranchName(repo, prNumber), MAIN_BRANCH, facts);
}
