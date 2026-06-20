import { prBranchName, promoteFacts, reviewPullRequest } from "../../../packages/core/src/index";
import { GitHubAppClient, verifyGitHubSignature } from "../../../packages/github/src/index";
import { createMemoryAdapter } from "../../../packages/memforks/src/index";
import { runIndex, createD1IndexStorage } from "../../../packages/indexer/src/index";
import { generateFix } from "../../../packages/ai/src/index";
import { createFixVerifier } from "../../../packages/sandbox/src/index";
import { createMcpHandlers } from "../../../packages/mcp/src/index";
import { evaluatePullRequestTrigger } from "../../../packages/trigger/src/index";
import { logger } from "./logger";

const log = logger.child("api");
import {
  createRun,
  failRun,
  getRun,
  getRepoId,
  getInstallationForRepo,
  getIndexStatus,
  getDocsForRepo,
  getTriggerConfig,
  saveTriggerConfig,
  listInstallations,
  listRepos as listReposFromDb,
  listRuns,
  markRunRunning,
  markInstallationActive,
  markInstallationInactive,
  saveFixDiff,
  saveFeedback,
  getFeedbackStats,
  getFindingsForRun,
  saveMemoryEvent,
  saveReviewResult,
  upsertInstallation,
  upsertPullRequest,
  upsertRepo,
} from "./storage";
import type { Env, ReviewJob, IndexJob, QueueJob, CommentCommand } from "./types";

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GitHub-Event, X-Hub-Signature-256",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      ...init.headers,
    },
  });
}

function requireEnv(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

// ─── Comment command parser ───────────────────────────────────────

function parseCommentCommand(body: string): CommentCommand | null {
  const text = body.trim();
  // Match /forkbot <command> [args] or @ForkBot <command> [args]
  const match = text.match(/^(?:\/forkbot|@ForkBot)\s+(\w+)(.*)$/i);
  if (!match) return null;

  const command = match[1].toLowerCase() as CommentCommand["command"];
  const rest = match[2].trim();
  const args = rest ? rest.split(/\s+/).filter(Boolean) : [];
  const validCommands: CommentCommand["command"][] = ["review", "fix", "describe", "ask", "promote", "status", "help"];
  if (!validCommands.includes(command)) return null;

  const result: CommentCommand = { command, args };

  if (command === "fix" && args.length > 0) {
    const num = parseInt(args[0].replace(/^#/, ""), 10);
    if (!isNaN(num)) result.findingNumber = num;
  }

  if (command === "ask") {
    result.question = rest;
  }

  if (command === "promote") {
    result.facts = args;
  }

  return result;
}

// ─── Webhook event handlers ───────────────────────────────────────

async function handleInstallation(body: {
  action: string;
  installation: { id: number; account?: { login: string } };
  repositories?: Array<{ full_name: string; default_branch: string }>;
}, env: Env): Promise<Response> {
  if (body.action === "deleted") {
    await markInstallationInactive(env.DB, body.installation.id);
    return json({ ok: true, action: "deactivated" });
  }

  const installationKey = await markInstallationActive(env.DB, body.installation.id, body.installation.account?.login ?? "unknown");

  if (body.repositories) {
    for (const repo of body.repositories) {
      // Create repo record in DB
      await upsertRepo(env.DB, installationKey, repo.full_name, repo.default_branch ?? "main");
      // Enqueue indexing job
      await env.QUEUE.send({
        type: "index",
        repoId: repo.full_name,
        repoUrl: `https://github.com/${repo.full_name}.git`,
        defaultBranch: repo.default_branch ?? "main",
        installationId: body.installation.id,
      } as IndexJob);
    }
  }

  return json({ ok: true, action: body.action, reposIndexed: body.repositories?.length ?? 0 });
}

async function handlePullRequest(body: {
  action: string;
  installation?: { id: number; account?: { login: string } };
  repository: { full_name: string; default_branch: string };
  pull_request: { number: number; title: string; state: string; head: { sha: string; ref: string }; base: { sha: string; ref: string }; labels?: Array<{ name: string }> };
}, env: Env): Promise<Response> {
  if (!["opened", "synchronize", "reopened"].includes(body.action)) return json({ ok: true, ignored: body.action });
  if (!body.installation?.id) return json({ error: "missing installation" }, { status: 400 });

  const repo = body.repository.full_name;
  const prNum = body.pull_request.number;
  log.info("Processing PR event", { repo, pr: prNum, action: body.action });

  const installationKey = await upsertInstallation(env.DB, body.installation.id, body.installation.account?.login ?? "unknown");
  const repoKey = await upsertRepo(env.DB, installationKey, repo, body.repository.default_branch);
  const prKey = await upsertPullRequest(env.DB, repoKey, {
    number: body.pull_request.number,
    title: body.pull_request.title,
    headSha: body.pull_request.head.sha,
    baseSha: body.pull_request.base.sha,
    state: body.pull_request.state,
  });

  // Evaluate trigger config before enqueuing
  const config = await getTriggerConfig(env.DB, body.repository.full_name);
  const triggerConfig = config
    ? {
        id: config.id,
        repoId: config.repo_id,
        triggerMode: config.trigger_mode as "auto" | "comment" | "custom",
        configJson: JSON.parse(config.config_json),
        updatedAt: config.updated_at,
      }
    : null;

  const evaluation = evaluatePullRequestTrigger(
    {
      action: body.action,
      repository: body.repository,
      pull_request: {
        ...body.pull_request,
        head: body.pull_request.head, // GitHub webhook includes sha + ref
        base: body.pull_request.base, // GitHub webhook includes sha + ref
        labels: body.pull_request.labels ?? [],
      },
      installation: body.installation,
    },
    triggerConfig,
  );

  if (!evaluation.shouldTrigger) {
    log.debug("PR review filtered by trigger config", { repo, pr: prNum, reason: evaluation.reason, mode: evaluation.mode });
    return json({ ok: true, ignored: evaluation.reason, mode: evaluation.mode });
  }

  const runId = await createRun(env.DB, prKey, prBranchName(repo, prNum));

  await env.QUEUE.send({
    type: "review",
    runId,
    repo,
    prNumber: prNum,
    installationId: body.installation.id,
    trigger: "webhook",
  });

  log.info("Review queued", { runId, repo, pr: prNum });
  return json({ ok: true, runId, evaluation });
}

async function handleIssueComment(body: {
  action: string;
  installation?: { id: number };
  repository: { full_name: string };
  issue: { number: number; pull_request?: unknown };
  comment: { body: string };
}, env: Env): Promise<Response> {
  // Only handle comments on PRs
  if (body.action !== "created" || !body.issue.pull_request) return json({ ok: true, ignored: true });
  if (!body.installation?.id) return json({ error: "missing installation" }, { status: 400 });

  const cmd = parseCommentCommand(body.comment.body);
  if (!cmd) return json({ ok: true, ignored: "unknown command" });

  if (cmd.command === "review") {
    const runId = `run_${crypto.randomUUID().replaceAll("-", "")}`;
    await env.QUEUE.send({
      type: "review",
      runId,
      repo: body.repository.full_name,
      prNumber: body.issue.number,
      installationId: body.installation.id,
      trigger: "comment_tag",
    });
    return json({ ok: true, runId, trigger: "comment_tag" });
  }

  if (cmd.command === "help") {
    const helpText = `### ForkBot Commands\n\nAvailable commands in PR comments:\n\n| Command | Description |\n|---------|-------------|\n| \`/forkbot review\` | Trigger a full review |\n| \`/forkbot fix <#>\` | Generate a fix for finding # |\n| \`/forkbot describe\` | Describe what this PR does |\n| \`/forkbot ask <question>\` | Ask about the PR |\n| \`/forkbot promote <facts>\` | Promote conventions |\n| \`/forkbot status\` | Check review status |\n| \`/forkbot help\` | Show this help |\n\nOr mention @ForkBot instead of /forkbot.`;

    // Post help as a comment reply
    const github = new GitHubAppClient({
      appId: requireEnv(env, "GITHUB_APP_ID"),
      privateKey: requireEnv(env, "GITHUB_APP_PRIVATE_KEY"),
      installationId: body.installation.id,
    });
    await github.postComment(body.repository.full_name, body.issue.number, helpText);
    return json({ ok: true, command: "help" });
  }

  return json({ ok: true, command: cmd.command, handled: false });
}

async function handleInstallationRepos(body: {
  action: string;
  installation: { id: number };
  repositories_added?: Array<{ full_name: string; default_branch: string }>;
  repositories_removed?: Array<{ full_name: string }>;
}, env: Env): Promise<Response> {
  const installationKey = `inst_${body.installation.id}`;

  if (body.repositories_added) {
    for (const repo of body.repositories_added) {
      // Create repo record in DB
      await upsertRepo(env.DB, installationKey, repo.full_name, repo.default_branch ?? "main");
      // Enqueue indexing job
      await env.QUEUE.send({
        type: "index",
        repoId: repo.full_name,
        repoUrl: `https://github.com/${repo.full_name}.git`,
        defaultBranch: repo.default_branch ?? "main",
        installationId: body.installation.id,
      } as IndexJob);
    }
  }
  return json({ ok: true, added: body.repositories_added?.length ?? 0, removed: body.repositories_removed?.length ?? 0 });
}

// ─── Main webhook handler ─────────────────────────────────────────

async function handleGitHubWebhook(request: Request, env: Env): Promise<Response> {
  const payload = await request.text();
  const ok = await verifyGitHubSignature(payload, request.headers.get("X-Hub-Signature-256"), requireEnv(env, "GITHUB_WEBHOOK_SECRET"));
  if (!ok) {
    log.warn("Invalid webhook signature");
    return json({ error: "invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("X-GitHub-Event") ?? "";
  const body = JSON.parse(payload);

  log.info("Webhook received", { event, action: body.action, repo: body.repository?.full_name });

  switch (event) {
    case "installation":
      return handleInstallation(body, env);
    case "installation_repositories":
      return handleInstallationRepos(body, env);
    case "pull_request":
      return handlePullRequest(body, env);
    case "issue_comment":
      return handleIssueComment(body, env);
    default:
      log.debug("Ignored webhook event", { event });
      return json({ ok: true, ignored: event });
  }
}

async function runReviewJob(env: Env, job: ReviewJob): Promise<void> {
  await markRunRunning(env.DB, job.runId);
  try {
    const github = new GitHubAppClient({
      appId: requireEnv(env, "GITHUB_APP_ID"),
      privateKey: requireEnv(env, "GITHUB_APP_PRIVATE_KEY"),
      installationId: job.installationId,
    });
    const pr = await github.fetchPrDiff(job.repo, job.prNumber);
    const memory = await createMemoryAdapter(env);
    const result = await reviewPullRequest(
      {
        repo: job.repo,
        prNumber: job.prNumber,
        title: pr.title,
        diff: pr.diff,
        headSha: pr.headSha,
        baseSha: pr.baseSha,
      },
      memory,
    );
    await saveReviewResult(env.DB, job.runId, result);
    await github.postComment(job.repo, job.prNumber, result.markdown);
    await github.createCheckRun(job.repo, pr.headSha, {
      title: result.status === "failure" ? "ForkBot found blocking issues" : "ForkBot review complete",
      summary: result.summary,
      conclusion: result.status,
    });
  } catch (error) {
    await failRun(env.DB, job.runId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function handleLocalReview(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { repo?: string; prNumber?: number; diff?: string; title?: string };
  const repo = body.repo ?? "local/repo";
  const prNumber = body.prNumber ?? 1;
  const installationKey = await upsertInstallation(env.DB, 0, "local");
  const repoKey = await upsertRepo(env.DB, installationKey, repo);
  const prKey = await upsertPullRequest(env.DB, repoKey, { number: prNumber, title: body.title ?? "Local review", state: "open" });
  const runId = await createRun(env.DB, prKey, prBranchName(repo, prNumber));
  await markRunRunning(env.DB, runId);
  const memory = await createMemoryAdapter(env);
  const result = await reviewPullRequest({ repo, prNumber, title: body.title, diff: body.diff ?? "" }, memory);
  await saveReviewResult(env.DB, runId, result);
  return json({
    id: runId,
    status: "completed",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...result,
  });
}

// ─── Repo sync handler ──────────────────────────────────────────────

async function handleRepoSync(request: Request, env: Env): Promise<Response> {
  const appId = requireEnv(env, "GITHUB_APP_ID");
  const privateKey = requireEnv(env, "GITHUB_APP_PRIVATE_KEY");

  const installations = await listInstallations(env.DB);
  let totalSynced = 0;

  for (const inst of installations) {
    try {
      const github = new GitHubAppClient({ appId, privateKey, installationId: inst.github_installation_id });
      const token = await github.getInstallationToken();

      // Fetch repos from GitHub for this installation
      const reposRes = await fetch("https://api.github.com/installation/repositories", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "forkbot-api/1.0",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!reposRes.ok) {
        console.error(`Failed to fetch repos for installation ${inst.github_installation_id}`, reposRes.status);
        continue;
      }

      const reposData = await reposRes.json() as { repositories: Array<{ full_name: string; default_branch: string }> };
      for (const repo of reposData.repositories) {
        await upsertRepo(env.DB, inst.id, repo.full_name, repo.default_branch ?? "main");
        totalSynced++;
      }
    } catch (error) {
      console.error(`Error syncing repos for installation ${inst.github_installation_id}:`, error);
    }
  }

  return json({ ok: true, installationsSynced: installations.length, reposSynced: totalSynced });
}

// ─── Index job handler ──────────────────────────────────────────────

async function runIndexJob(env: Env, job: IndexJob): Promise<void> {
  try {
    const appId = requireEnv(env, "GITHUB_APP_ID");
    const privateKey = requireEnv(env, "GITHUB_APP_PRIVATE_KEY");
    const github = new GitHubAppClient({ appId, privateKey, installationId: job.installationId });

    const storage = createD1IndexStorage(env.DB);

    await runIndex(
      job.repoId,
      job.repoUrl,
      job.defaultBranch,
      {
        githubToken: () => github.getInstallationToken(),
        ai: env.AI ?? { run: async () => ({ data: [[]] }) },
        vectorIndex: env.VECTOR_INDEX ?? {
          upsert: async () => {},
          query: async () => ({ matches: [] }),
        },
        storage,
      },
      (progress) => {
        storage.saveProgress(job.repoId, progress).catch(() => {});
      },
    );
  } catch (error) {
    console.error(`Index job failed for ${job.repoId}:`, error);
    throw error;
  }
}

async function handlePromotion(request: Request, env: Env, runId: string): Promise<Response> {
  const run = await getRun(env.DB, runId);
  if (!run) return json({ error: "run not found" }, { status: 404 });
  const body = (await request.json()) as { facts?: string[] };
  const facts = body.facts ?? [];
  if (facts.length === 0) return json({ error: "facts required" }, { status: 400 });
  const memory = await createMemoryAdapter(env);
  const event = await promoteFacts(String(run.repo), Number(run.pr_number), facts, memory);
  await saveMemoryEvent(env.DB, runId, event);
  return json(event);
}

// ─── Fix pipeline handler ──────────────────────────────────────────

async function handleFixGeneration(request: Request, env: Env, runId: string): Promise<Response> {
  const run = await getRun(env.DB, runId);
  if (!run) return json({ error: "run not found" }, { status: 404 });

  const body = (await request.json()) as { findingId?: string; codeContext?: string };
  if (!body.findingId) return json({ error: "findingId required" }, { status: 400 });

  const findings = (run.findings ?? []) as Array<{ ruleId: string; severity: string; filePath: string; line: number | null; title: string; body: string; suggestion: string; memoryFact: string }>;
  const finding = findings.find((f: { ruleId: string }) => f.ruleId === body.findingId);
  if (!finding) return json({ error: "finding not found" }, { status: 404 });

  try {
    // Step 1: Generate the fix via AI
    const fixResult = await generateFix(
      finding,
      body.codeContext ?? `File: ${finding.filePath}${finding.line ? `:${finding.line}` : ""}`,
      { aiBinding: env.AI, env },
    );

    // Step 2: Verify the fix via sandbox (dry-run by default)
    const verifier = createFixVerifier();
    const verification = await verifier.verify(fixResult.patch, finding);

    // Step 3: Store the fix diff
    const fixId = await saveFixDiff(
      env.DB,
      runId,
      body.findingId,
      fixResult.patch,
      fixResult.explanation,
      verification.confidence,
      verification.passed,
      verification.log,
    );

    return json({
      id: fixId,
      patch: fixResult.patch,
      explanation: fixResult.explanation,
      confidence: verification.confidence,
      verified: verification.passed,
      sandboxLog: verification.log,
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : String(error),
      patch: "",
      explanation: "Fix generation failed.",
      confidence: 0,
      verified: false,
    });
  }
}

// ─── OAuth handlers ────────────────────────────────────────────────

async function handleOAuthLogin(request: Request, env: Env): Promise<Response> {
  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) return json({ error: "OAuth not configured" }, { status: 500 });
  const redirectUri = `${new URL(request.url).origin}/api/auth/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20read:org`;
  return Response.redirect(url, 302);
}

async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // If this is an installation callback (installation_id + setup_action=install),
  // skip OAuth and redirect to dashboard — the webhook already handled it
  if (requestUrl.searchParams.has("installation_id")) {
    return Response.redirect(new URL("/", requestUrl.origin).toString(), 302);
  }

  if (!code) return json({ error: "missing code" }, { status: 400 });

  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return json({ error: "OAuth not configured" }, { status: 500 });

  // Exchange code for access token (GitHub App OAuth — scopes are ignored, permissions come from App settings)
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!tokenRes.ok) return json({ error: "token exchange failed" }, { status: 502 });
  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token) return json({ error: tokenData.error ?? "no token" }, { status: 502 });

  // Fetch user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "forkbot-api/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!userRes.ok) {
    const errorBody = await userRes.text();
    console.error("GitHub user fetch failed", { status: userRes.status, body: errorBody });
    return json({
      error: "user fetch failed",
      detail: `GitHub returned ${userRes.status}: ${errorBody.substring(0, 300)}`,
      hint: "Go to https://github.com/settings/apps/forkbot-dev → 'Permissions' > 'Account permissions' > set 'GitHub user profile' to 'Read-only' then Save."
    }, { status: 502 });
  }
  const user = await userRes.json() as { id: number; login: string };

  // Create session
  const sessionToken = crypto.randomUUID();
  await env.DB
    .prepare("INSERT INTO oauth_sessions (id, github_user_id, github_login, access_token, session_token, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(
      `session_${sessionToken.replace(/-/g, "")}`,
      user.id,
      user.login,
      tokenData.access_token,
      sessionToken,
      new Date(Date.now() + 7 * 86400_000).toISOString(),
    )
    .run();

  // Redirect to dashboard with session cookie
  const redirectUrl = new URL("/", requestUrl.origin);
  redirectUrl.searchParams.set("session", sessionToken);
  return Response.redirect(redirectUrl.toString(), 302);
}

async function handleSessionCheck(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return json({ authenticated: false }, { status: 401 });

  const session = await env.DB
    .prepare("SELECT github_user_id, github_login FROM oauth_sessions WHERE session_token = ? AND expires_at > datetime('now')")
    .bind(token)
    .first<{ github_user_id: number; github_login: string }>();

  if (!session) return json({ authenticated: false }, { status: 401 });
  return json({ authenticated: true, userId: session.github_user_id, login: session.github_login });
}

// Module-level MCP handlers — created once so sessions persist across requests
let mcpHandlers: ReturnType<typeof createMcpHandlers> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return json({ ok: true });
    const url = new URL(request.url);

    try {
      if (url.pathname === "/health") return json({ ok: true, service: "forkbot-api" });
      if (url.pathname === "/api/auth/github" && request.method === "GET")    return handleOAuthLogin(request, env);
      if (url.pathname === "/api/auth/callback" && request.method === "GET") return handleOAuthCallback(request, env);
      if (url.pathname === "/api/health") return json({ ok: true, service: "forkbot-api", timestamp: new Date().toISOString() });
      if (url.pathname === "/api/auth/session" && request.method === "GET") return handleSessionCheck(request, env);
      if (url.pathname === "/webhooks/github" && request.method === "POST") return handleGitHubWebhook(request, env);
      if (url.pathname === "/api/review/local" && request.method === "POST") return handleLocalReview(request, env);
      if (url.pathname === "/api/repos" && request.method === "GET") return json(await listReposFromDb(env.DB));
      if (url.pathname === "/api/repos/sync" && request.method === "POST") return handleRepoSync(request, env);
      if (url.pathname.startsWith("/api/repos/") && request.method === "POST") {
        const repoFullName = url.pathname.split("/").at(3) ?? "";
        const action = url.pathname.split("/").at(4);
        if (action === "index") {
          // Look up the installation ID for this repo
          const inst = await getInstallationForRepo(env.DB, repoFullName);
          if (!inst) return json({ error: "repo not found or no active installation" }, { status: 404 });
          await env.QUEUE.send({
            type: "index",
            repoId: repoFullName,
            repoUrl: `https://github.com/${repoFullName}.git`,
            defaultBranch: "main",
            installationId: inst.githubInstallationId,
          } as IndexJob);
          return json({ ok: true, action: "index_queued", repoId: repoFullName, installationId: inst.githubInstallationId });
        }
      }
      if (url.pathname.match(/^\/api\/repos\/[^/]+\/index\/status$/) && request.method === "GET") {
        const repoFullName = url.pathname.split("/").at(3) ?? "";
        const repoId = await getRepoId(env.DB, repoFullName);
        if (!repoId) return json({ status: "unknown", error: "repo not found" });
        const status = await getIndexStatus(env.DB, repoFullName);
        return json(status ?? { status: "not_started", step: null, progress: 0, error: null });
      }
      // Trigger config routes
      if (url.pathname.match(/^\/api\/repos\/[^/]+\/trigger$/) && request.method === "GET") {
        const repoFullName = url.pathname.split("/").at(3) ?? "";
        const config = await getTriggerConfig(env.DB, repoFullName);
        return json(config ?? { trigger_mode: "auto", config_json: "{}" });
      }
      if (url.pathname.match(/^\/api\/repos\/[^/]+\/trigger$/) && request.method === "PUT") {
        const repoFullName = url.pathname.split("/").at(3) ?? "";
        const body = await request.json() as { trigger_mode: string; config_json?: Record<string, unknown> };
        await saveTriggerConfig(env.DB, repoFullName, body.trigger_mode, body.config_json ?? {});
        return json({ ok: true, mode: body.trigger_mode });
      }
      if (url.pathname.match(/^\/api\/repos\/[^/]+\/docs$/) && request.method === "GET") {
        const repoFullName = url.pathname.split("/").at(3) ?? "";
        const docs = await getDocsForRepo(env.DB, repoFullName);
        return json(docs);
      }
      // Feedback routes
      if (url.pathname === "/api/feedback" && request.method === "POST") {
        const body = await request.json() as { findingId: string; runId: string; ruleId: string; feedbackType: string; comment?: string };
        const feedbackId = await saveFeedback(env.DB, body as Parameters<typeof saveFeedback>[1]);
        return json({ id: feedbackId, ok: true });
      }
      if (url.pathname === "/api/feedback/stats" && request.method === "GET") {
        return json(await getFeedbackStats(env.DB));
      }
      if (url.pathname.match(/^\/api\/runs\/[^/]+\/findings$/) && request.method === "GET") {
        const runId = url.pathname.split("/").at(3) ?? "";
        return json(await getFindingsForRun(env.DB, runId));
      }
      if (url.pathname === "/api/runs" && request.method === "GET") return json(await listRuns(env.DB, url.searchParams.get("repo") ?? undefined));
      if (url.pathname.startsWith("/api/runs/") && request.method === "GET") {
        const run = await getRun(env.DB, url.pathname.split("/").at(3) ?? "");
        return run ? json(run) : json({ error: "run not found" }, { status: 404 });
      }
      // MCP routes — AI agent handoff endpoint (lazy init, persists sessions across requests)
      if (!mcpHandlers) {
        mcpHandlers = createMcpHandlers(async (repo) => ({
          repo: repo ?? "unknown/repo",
          getToken: async () => "",
          db: env.DB,
          ai: env.AI,
          vectorIndex: env.VECTOR_INDEX,
        }));
      }
      const mcpResult = await mcpHandlers.handleMcpRequest(request);
      if (mcpResult) return mcpResult;

      if (url.pathname.match(/^\/api\/runs\/[^/]+\/fix$/) && request.method === "POST") {
        return handleFixGeneration(request, env, url.pathname.split("/").at(3) ?? "");
      }
      if (url.pathname.endsWith("/promote") && url.pathname.startsWith("/api/runs/") && request.method === "POST") {
        return handlePromotion(request, env, url.pathname.split("/").at(3) ?? "");
      }
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return json({ error: "not found" }, { status: 404 });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  },

  async queue(batch: { messages: Array<{ body: QueueJob; ack(): void; retry(): void }> }, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const job = message.body;
        if (job.type === "review") {
          await runReviewJob(env, job);
        } else if (job.type === "index") {
          await runIndexJob(env, job);
        }
        message.ack();
      } catch {
        message.retry();
      }
    }
  },
};
