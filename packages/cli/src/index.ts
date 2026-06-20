#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { promoteFacts, reviewPullRequest } from "../../core/src/index";
import { GitHubAppClient } from "../../github/src/index";
import { createMemoryAdapter } from "../../memforks/src/index";

type Args = Record<string, string | boolean>;

function parse(argv: string[]): { command: string; args: Args } {
  const [command = "help", ...rest] = argv;
  const args: Args = {};
  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return { command, args };
}

async function git(args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(stderr.trim() || `git ${args.join(" ")} failed`);
  return stdout;
}

async function diffFromArgs(args: Args): Promise<string> {
  if (typeof args.diff === "string") return readFile(args.diff, "utf8");
  if (typeof args.range === "string") return git(["diff", args.range]);
  return git(["diff", "--cached"]);
}

function env(key: string): string | undefined {
  return Bun.env[key];
}

function required(key: string): string {
  const value = env(key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

async function review(args: Args): Promise<void> {
  const repo = String(args.repo ?? env("GITHUB_REPOSITORY") ?? "local/repo");
  const prNumber = Number(args.pr ?? env("GITHUB_PR_NUMBER") ?? 1);
  let diff = "";
  let title = "Local review";
  let headSha: string | undefined;
  let baseSha: string | undefined;

  if (args.github) {
    const github = new GitHubAppClient({
      appId: required("GITHUB_APP_ID"),
      privateKey: required("GITHUB_APP_PRIVATE_KEY"),
      installationId: Number(required("GITHUB_INSTALLATION_ID")),
    });
    const pr = await github.fetchPrDiff(repo, prNumber);
    diff = pr.diff;
    title = pr.title;
    headSha = pr.headSha;
    baseSha = pr.baseSha;
  } else {
    diff = await diffFromArgs(args);
  }

  const memory = await createMemoryAdapter(Bun.env);
  const result = await reviewPullRequest({ repo, prNumber, title, diff, headSha, baseSha }, memory);

  if (args.comment && args.github) {
    const github = new GitHubAppClient({
      appId: required("GITHUB_APP_ID"),
      privateKey: required("GITHUB_APP_PRIVATE_KEY"),
      installationId: Number(required("GITHUB_INSTALLATION_ID")),
    });
    await github.postComment(repo, prNumber, result.markdown);
    if (headSha) {
      await github.createCheckRun(repo, headSha, {
        title: result.status === "failure" ? "ForkBot found blocking issues" : "ForkBot review complete",
        summary: result.summary,
        conclusion: result.status,
      });
    }
  }

  console.log(args.json ? JSON.stringify(result, null, 2) : result.markdown);
}

async function promote(args: Args): Promise<void> {
  const repo = String(args.repo ?? env("GITHUB_REPOSITORY") ?? "local/repo");
  const prNumber = Number(args.pr ?? env("GITHUB_PR_NUMBER") ?? 1);
  const facts = [args.fact, args.facts].filter((fact): fact is string => typeof fact === "string");
  if (facts.length === 0) throw new Error("--fact required");
  const memory = await createMemoryAdapter(Bun.env);
  console.log(JSON.stringify(await promoteFacts(repo, prNumber, facts, memory), null, 2));
}

async function apiReview(args: Args): Promise<void> {
  const api = String(args.api ?? env("FORKBOT_API_URL") ?? "http://localhost:8787");
  const repo = String(args.repo ?? "local/repo");
  const prNumber = Number(args.pr ?? 1);
  const diff = await diffFromArgs(args);
  const response = await fetch(`${api}/api/review/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, prNumber, diff }),
  });
  console.log(await response.text());
}

async function runs(args: Args): Promise<void> {
  const api = String(args.api ?? env("FORKBOT_API_URL") ?? "http://localhost:8787");
  const repo = typeof args.repo === "string" ? `?repo=${encodeURIComponent(args.repo)}` : "";
  const response = await fetch(`${api}/api/runs${repo}`);
  console.log(await response.text());
}

function help(): void {
  console.log(`ForkBot

Commands:
  forkbot review --diff patch.diff --repo owner/name --pr 123 [--json]
  forkbot review --github --repo owner/name --pr 123 [--comment]
  forkbot api-review --api http://localhost:8787 --diff patch.diff --repo owner/name --pr 123
  forkbot promote --repo owner/name --pr 123 --fact "approved convention"
  forkbot runs --api http://localhost:8787 [--repo owner/name]

MemForks:
  FORKBOT_MEMFORK_ENABLED=true enables real MemForks SDK calls.
  Dry-run mode is default for local development.`);
}

async function main(): Promise<void> {
  const { command, args } = parse(Bun.argv.slice(2));
  if (command === "help" || command === "--help" || command === "-h") return help();
  if (command === "review") return review(args);
  if (command === "api-review") return apiReview(args);
  if (command === "promote") return promote(args);
  if (command === "runs") return runs(args);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
