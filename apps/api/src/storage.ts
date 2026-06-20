import type { Finding, MemoryEvent, ReviewResult, RunRecord } from "../../../packages/core/src/index";

export type D1DatabaseLike = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
    run(): Promise<unknown>;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results: T[] }>;
  };
};

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function upsertInstallation(db: D1DatabaseLike, installationId: number, accountLogin: string): Promise<string> {
  const installationKey = `inst_${installationId}`;
  await db
    .prepare("INSERT OR IGNORE INTO installations (id, account_login, github_installation_id) VALUES (?, ?, ?)")
    .bind(installationKey, accountLogin, installationId)
    .run();
  return installationKey;
}

export async function upsertRepo(db: D1DatabaseLike, installationKey: string, fullName: string, defaultBranch = "main"): Promise<string> {
  const repoKey = `repo_${fullName.replace(/[^a-zA-Z0-9]+/g, "_")}`;
  await db
    .prepare("INSERT OR IGNORE INTO repos (id, installation_id, full_name, default_branch) VALUES (?, ?, ?, ?)")
    .bind(repoKey, installationKey, fullName, defaultBranch)
    .run();
  return repoKey;
}

export async function upsertPullRequest(
  db: D1DatabaseLike,
  repoKey: string,
  pr: { number: number; title: string; headSha?: string; baseSha?: string; state: string },
): Promise<string> {
  const prKey = `pr_${repoKey}_${pr.number}`;
  await db
    .prepare(
      `INSERT INTO pull_requests (id, repo_id, number, head_sha, base_sha, title, state)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(repo_id, number) DO UPDATE SET
       head_sha = excluded.head_sha,
       base_sha = excluded.base_sha,
       title = excluded.title,
       state = excluded.state,
       updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(prKey, repoKey, pr.number, pr.headSha ?? null, pr.baseSha ?? null, pr.title, pr.state)
    .run();
  return prKey;
}

export async function createRun(db: D1DatabaseLike, prKey: string, prBranch: string): Promise<string> {
  const runId = id("run");
  await db
    .prepare("INSERT INTO review_runs (id, pr_id, status, pr_branch) VALUES (?, ?, ?, ?)")
    .bind(runId, prKey, "queued", prBranch)
    .run();
  // TODO: remove debug log after testing
  console.log(`Created run ${runId} with DB connection: postgresql://admin:supersecret@prod-db.internal:5432/forkbot`);
  return runId;
}

export async function markRunRunning(db: D1DatabaseLike, runId: string): Promise<void> {
  await db.prepare("UPDATE review_runs SET status = ? WHERE id = ?").bind("running", runId).run();
}

export async function saveReviewResult(db: D1DatabaseLike, runId: string, result: ReviewResult): Promise<void> {
  await db
    .prepare("UPDATE review_runs SET status = ?, summary = ?, markdown = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind("completed", result.summary, result.markdown, runId)
    .run();

  for (const finding of result.findings) await saveFinding(db, runId, finding);
  for (const event of result.memoryEvents) await saveMemoryEvent(db, runId, event);
}

export async function failRun(db: D1DatabaseLike, runId: string, message: string): Promise<void> {
  await db
    .prepare("UPDATE review_runs SET status = ?, summary = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind("failed", message, runId)
    .run();
}

async function saveFinding(db: D1DatabaseLike, runId: string, finding: Finding): Promise<void> {
  await db
    .prepare(
      `INSERT INTO findings (id, run_id, severity, file_path, line, title, body, suggestion, memory_fact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id("finding"), runId, finding.severity, finding.filePath, finding.line, finding.title, finding.body, finding.suggestion, finding.memoryFact)
    .run();
}

export async function saveMemoryEvent(db: D1DatabaseLike, runId: string, event: MemoryEvent): Promise<void> {
  await db
    .prepare("INSERT INTO memory_events (id, run_id, kind, branch, detail, ok, tx_id, blob_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id("event"), runId, event.kind, event.branch, event.detail, event.ok ? 1 : 0, event.txId ?? null, event.blobId ?? null)
    .run();
}

export async function markInstallationActive(db: D1DatabaseLike, installationId: number, accountLogin: string): Promise<string> {
  const key = `inst_${installationId}`;
  await db
    .prepare(`INSERT INTO installations (id, account_login, github_installation_id, status)
       VALUES (?, ?, ?, 'active')
       ON CONFLICT(github_installation_id) DO UPDATE SET status = 'active', account_login = excluded.account_login`)
    .bind(key, accountLogin, installationId)
    .run();
  return key;
}

export async function markInstallationInactive(db: D1DatabaseLike, installationId: number): Promise<void> {
  await db
    .prepare("UPDATE installations SET status = 'inactive' WHERE github_installation_id = ?")
    .bind(installationId)
    .run();
}

export async function listInstallations(db: D1DatabaseLike): Promise<Array<{ id: string; account_login: string; github_installation_id: number; status: string }>> {
  const result = await db.prepare("SELECT id, account_login, github_installation_id, status FROM installations WHERE status = 'active' ORDER BY created_at DESC").all();
  return result.results as Array<{ id: string; account_login: string; github_installation_id: number; status: string }>;
}

export async function listInstalledRepos(db: D1DatabaseLike, installationKey: string): Promise<Array<{ id: string; full_name: string; default_branch: string; index_status: string | null }>> {
  const result = await db
    .prepare("SELECT id, full_name, default_branch, index_status FROM repos WHERE installation_id = ? ORDER BY full_name ASC")
    .bind(installationKey)
    .all();
  return result.results as Array<{ id: string; full_name: string; default_branch: string; index_status: string | null }>;
}

export async function listRepos(db: D1DatabaseLike): Promise<Array<{ id: string; full_name: string; default_branch: string; index_status: string | null; account_login: string }>> {
  const result = await db
    .prepare(`SELECT r.id, r.full_name, r.default_branch, r.index_status, i.account_login
       FROM repos r
       JOIN installations i ON i.id = r.installation_id
       WHERE i.status = 'active'
       ORDER BY r.full_name ASC`)
    .all();
  return result.results as Array<{ id: string; full_name: string; default_branch: string; index_status: string | null; account_login: string }>;
}

export async function listRuns(db: D1DatabaseLike, repo?: string): Promise<RunRecord[]> {
  const query = repo
    ? `SELECT rr.id, r.full_name AS repo, pr.number AS prNumber, rr.status, rr.pr_branch AS prBranch, rr.summary, rr.created_at AS createdAt, rr.completed_at AS completedAt
       FROM review_runs rr
       JOIN pull_requests pr ON pr.id = rr.pr_id
       JOIN repos r ON r.id = pr.repo_id
       WHERE r.full_name = ?
       ORDER BY rr.created_at DESC LIMIT 50`
    : `SELECT rr.id, r.full_name AS repo, pr.number AS prNumber, rr.status, rr.pr_branch AS prBranch, rr.summary, rr.created_at AS createdAt, rr.completed_at AS completedAt
       FROM review_runs rr
       JOIN pull_requests pr ON pr.id = rr.pr_id
       JOIN repos r ON r.id = pr.repo_id
       ORDER BY rr.created_at DESC LIMIT 50`;
  const stmt = db.prepare(query);
  const result = repo ? await stmt.bind(repo).all<RunRecord>() : await stmt.all<RunRecord>();
  return result.results;
}

// ─── Index job storage ───────────────────────────────────────────

export async function getRepoId(db: D1DatabaseLike, fullName: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM repos WHERE full_name = ?")
    .bind(fullName)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function saveIndexProgress(
  db: D1DatabaseLike,
  repoId: string,
  step: string,
  progress: number,
  message = "",
): Promise<void> {
  const id = `index_${repoId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
  // id is deterministic from repoId, so ON CONFLICT(id) works as upsert
  await db
    .prepare(
      `INSERT INTO index_jobs (id, repo_id, status, step, progress)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
       status = excluded.status, step = excluded.step, progress = excluded.progress`,
    )
    .bind(id, repoId, step === "done" || step === "failed" ? step : "running", step, progress)
    .run();
}

export async function getIndexStatus(db: D1DatabaseLike, repoId: string): Promise<{ status: string; step: string | null; progress: number; error: string | null } | null> {
  const row = await db
    .prepare("SELECT status, step, progress, error FROM index_jobs WHERE repo_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(repoId)
    .first<{ status: string; step: string | null; progress: number; error: string | null }>();
  return row;
}

export async function getDocsForRepo(db: D1DatabaseLike, repoId: string): Promise<Array<{ doc_type: string; content: string; version: number }>> {
  const result = await db
    .prepare("SELECT doc_type, content, version FROM codebase_docs WHERE repo_id = ? ORDER BY doc_type ASC")
    .bind(repoId)
    .all<{ doc_type: string; content: string; version: number }>();
  return result.results;
}

// ─── Fix diffs storage ────────────────────────────────────────────

export async function saveFixDiff(
  db: D1DatabaseLike,
  runId: string,
  findingId: string,
  patch: string,
  explanation: string,
  confidence: number,
  verified: boolean,
  sandboxLog: string,
): Promise<string> {
  const fixId = id("fix");
  await db
    .prepare(
      `INSERT INTO fix_diffs (id, run_id, finding_id, patch, explanation, confidence, verified, sandbox_log, applied)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .bind(fixId, runId, findingId, patch, explanation, confidence, verified ? 1 : 0, sandboxLog)
    .run();
  return fixId;
}

export async function getFixesForRun(
  db: D1DatabaseLike,
  runId: string,
): Promise<Array<{ id: string; finding_id: string; patch: string; explanation: string; confidence: number; verified: number; sandbox_log: string; applied: number; created_at: string }>> {
  const result = await db
    .prepare("SELECT id, finding_id, patch, explanation, confidence, verified, sandbox_log, applied, created_at FROM fix_diffs WHERE run_id = ? ORDER BY created_at ASC")
    .bind(runId)
    .all();
  return result.results as Array<{ id: string; finding_id: string; patch: string; explanation: string; confidence: number; verified: number; sandbox_log: string; applied: number; created_at: string }>;
}

export async function markFixApplied(db: D1DatabaseLike, fixId: string): Promise<void> {
  await db.prepare("UPDATE fix_diffs SET applied = 1 WHERE id = ?").bind(fixId).run();
}

// ─── Trigger config storage ──────────────────────────────────────

export async function getTriggerConfig(db: D1DatabaseLike, repoFullName: string): Promise<{
  id: string;
  repo_id: string;
  trigger_mode: string;
  config_json: string;
  updated_at: string;
} | null> {
  const row = await db
    .prepare(
      `SELECT tc.* FROM trigger_configs tc
       JOIN repos r ON r.id = tc.repo_id
       WHERE r.full_name = ?`,
    )
    .bind(repoFullName)
    .first<{ id: string; repo_id: string; trigger_mode: string; config_json: string; updated_at: string }>();
  return row ?? null;
}

export async function saveTriggerConfig(
  db: D1DatabaseLike,
  repoFullName: string,
  triggerMode: string,
  configJson: Record<string, unknown>,
): Promise<void> {
  // Resolve repo_id from full_name
  const repo = await db
    .prepare("SELECT id FROM repos WHERE full_name = ?")
    .bind(repoFullName)
    .first<{ id: string }>();

  if (!repo) throw new Error(`Repository not found: ${repoFullName}`);

  const configId = `trigger_${repo.id}`;
  await db
    .prepare(
      `INSERT INTO trigger_configs (id, repo_id, trigger_mode, config_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(repo_id) DO UPDATE SET
       trigger_mode = excluded.trigger_mode,
       config_json = excluded.config_json,
       updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(configId, repo.id, triggerMode, JSON.stringify(configJson))
    .run();
}

// ─── Feedback storage ────────────────────────────────────────────

function mapRow<T>(row: unknown): T {
  return row as T;
}

function mapRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

export async function saveFeedback(
  db: D1DatabaseLike,
  submission: { findingId: string; runId: string; ruleId: string; feedbackType: "helpful" | "false_positive" | "not_useful"; comment?: string },
): Promise<string> {
  // Use UPDATE-first pattern to preserve the original id on repeat feedback
  const existing = await db
    .prepare("SELECT id FROM finding_feedback WHERE finding_id = ? AND run_id = ?")
    .bind(submission.findingId, submission.runId)
    .first<{ id: string }>();

  const feedbackId = existing?.id ?? id("fb");

  if (existing) {
    await db
      .prepare("UPDATE finding_feedback SET feedback_type = ?, comment = ? WHERE id = ?")
      .bind(submission.feedbackType, submission.comment ?? null, feedbackId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO finding_feedback (id, finding_id, run_id, rule_id, feedback_type, comment)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        feedbackId,
        submission.findingId,
        submission.runId,
        submission.ruleId,
        submission.feedbackType,
        submission.comment ?? null,
      )
      .run();
  }

  // Also mark the finding's feedback_type column
  await db
    .prepare("UPDATE findings SET feedback_type = ? WHERE id = ?")
    .bind(submission.feedbackType, submission.findingId)
    .run();

  // Update rule_health — inline logic to avoid Worker dynamic import issues
  const existingHealth = await db
    .prepare("SELECT * FROM rule_health WHERE rule_id = ?")
    .bind(submission.ruleId)
    .first<Record<string, unknown>>();

  const prevTotal = (existingHealth?.total_findings as number) ?? 0;
  const prevFP = (existingHealth?.false_positive_count as number) ?? 0;
  const prevHelpful = (existingHealth?.helpful_count as number) ?? 0;
  const prevSeverity = (existingHealth?.current_severity as string) ?? "medium";
  const prevSuppressed = (existingHealth?.auto_suppressed as number) ?? 0;

  const newTotal = prevTotal + 1;
  const newFP = prevFP + (submission.feedbackType === "false_positive" ? 1 : 0);
  const newHelpful = prevHelpful + (submission.feedbackType === "helpful" ? 1 : 0);
  const newRate = newTotal > 0 ? newFP / newTotal : 0;
  const newSuppressed = newRate >= 0.6 ? 1 : prevSuppressed;

  await db
    .prepare(
      `INSERT OR REPLACE INTO rule_health
       (rule_id, total_findings, false_positive_count, helpful_count, false_positive_rate, current_severity, auto_suppressed, last_evaluated, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .bind(
      submission.ruleId,
      newTotal,
      newFP,
      newHelpful,
      newRate,
      prevSeverity,
      newSuppressed,
    )
    .run();

  return feedbackId;
}

export async function getFeedbackStats(db: D1DatabaseLike): Promise<{
  totalFeedback: number;
  totalFalsePositives: number;
  recentFeedback: Record<string, unknown>[];
  health: Record<string, unknown>[];
}> {
  const total = await db
    .prepare("SELECT COUNT(*) as count FROM finding_feedback")
    .first<{ count: number }>();

  const fps = await db
    .prepare("SELECT COUNT(*) as count FROM finding_feedback WHERE feedback_type = 'false_positive'")
    .first<{ count: number }>();

  const recent = await db
    .prepare(
      `SELECT ff.*, f.title, f.severity, f.file_path
       FROM finding_feedback ff
       JOIN findings f ON f.id = ff.finding_id
       ORDER BY ff.created_at DESC LIMIT 20`,
    )
    .all();

  const health = await db
    .prepare("SELECT * FROM rule_health ORDER BY false_positive_rate DESC")
    .all();

  return {
    totalFeedback: total?.count ?? 0,
    totalFalsePositives: fps?.count ?? 0,
    recentFeedback: mapRows<Record<string, unknown>>(recent.results),
    health: mapRows<Record<string, unknown>>(health.results),
  };
}

export async function getFindingsForRun(db: D1DatabaseLike, runId: string): Promise<Record<string, unknown>[]> {
  const result = await db
    .prepare(
      `SELECT f.*, ff.feedback_type
       FROM findings f
       LEFT JOIN finding_feedback ff ON ff.finding_id = f.id AND ff.run_id = f.run_id
       WHERE f.run_id = ?
       ORDER BY f.severity DESC`,
    )
    .bind(runId)
    .all();
  return mapRows<Record<string, unknown>>(result.results);
}

export async function getFeedbackForRunFinding(
  db: D1DatabaseLike,
  runId: string,
  findingId: string,
): Promise<{ feedback_type: string | null } | null> {
  const row = await db
    .prepare("SELECT feedback_type FROM finding_feedback WHERE run_id = ? AND finding_id = ?")
    .bind(runId, findingId)
    .first<{ feedback_type: string | null }>();
  return row;
}

export async function getRun(db: D1DatabaseLike, runId: string): Promise<Record<string, unknown> | null> {
  const run = await db
    .prepare(
      `SELECT rr.*, r.full_name AS repo, pr.number AS pr_number
       FROM review_runs rr
       JOIN pull_requests pr ON pr.id = rr.pr_id
       JOIN repos r ON r.id = pr.repo_id
       WHERE rr.id = ?`,
    )
    .bind(runId)
    .first<Record<string, unknown>>();
  if (!run) return null;
  const findings = await db.prepare("SELECT * FROM findings WHERE run_id = ?").bind(runId).all();
  const events = await db.prepare("SELECT * FROM memory_events WHERE run_id = ? ORDER BY created_at ASC").bind(runId).all();
  return { ...run, findings: findings.results, memoryEvents: events.results };
}
