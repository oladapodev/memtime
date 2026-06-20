# ForkBot — Plan & Architecture

## What is ForkBot?

ForkBot is a **GitHub App** that automatically reviews pull requests using AI-powered code analysis with **isolated memory branches**. Each PR gets its own sandboxed memory context, so no cross-PR knowledge bleeds. Only verified, promoted conventions merge back to the shared memory.

---

## Current Commands (PR Comments)

These are slash commands you can use on any PR where ForkBot is installed:

| Command | What it does |
|---------|-------------|
| `/forkbot review` | Triggers a full PR review |
| `/forkbot fix <#>` | Generates a fix for a specific finding |
| `/forkbot describe` | Describes what the PR does |
| `/forkbot ask <question>` | Asks a question about the PR diff |
| `/forkbot promote <facts>` | Promotes conventions to shared memory |
| `/forkbot status` | Checks review status |
| `/forkbot help` | Shows available commands |

You can also mention `@ForkBot` instead of `/forkbot`.

---

## What Makes It Novel

### 1. Isolated Memory Per PR

Every PR gets a **fork of the memory tree** on Sui blockchain (via MemForks). The reviewer starts from trusted conventions in `main`, adds PR-specific findings to its own branch, and never pollutes the shared memory.

### 2. Governed Promotion

Findings stay in the PR's memory branch until a **maintainer explicitly promotes** them back to `main` via the dashboard or CLI. Nothing auto-merges — no polluted memory.

### 3. Architecture-Aware Reviews

ForkBot doesn't just lint the diff. It understands the full codebase (exports, types, dependencies) through vector indexing, so it catches structural regressions, not just formatting issues.

### 4. Feedback Loop

Users can mark findings as "helpful" or "false positive" directly on the dashboard. ForkBot learns which rules are noisy and can auto-suppress rules that exceed a 60% false-positive rate.

### 5. On-Chain Memory

Memory lives on Sui, not in a database. This means:
- ForkBot's knowledge persists across restarts
- Memory is verifiable and traceable
- Conventions are owned by the team, not the platform

---

## Core Flow

```
1. GitHub sends webhook → Worker receives it
2. Worker creates PR record in D1, enqueues review job
3. Queue consumer fetches PR diff via GitHub App token
4. Consumer forks memory from main → pr/owner-repo/123
5. Review engine runs rules against the diff
6. Consumer posts comment + check run on GitHub
7. Findings + memory facts stored in D1 + Sui
8. Maintainer promotes conventions from dashboard/CLI
```

---

## What's Working Now

| Feature | Status |
|---------|--------|
| OAuth sign-in via GitHub | ✅ Working |
| Dashboard (overview, repos, reviews, feedback) | ✅ Working |
| Repo sync from GitHub App installation | ✅ Working |
| On-demand indexing (click "Index" per repo) | ✅ Working |
| CLI review (`bun run review:demo`) | ✅ Working |
| MemForks persistent memory on Sui | ✅ Connected |
| Manual review via dashboard ("Run review" form) | ✅ Working |

## What's Broken / Missing

| Feature | Issue | Fix Needed |
|---------|-------|------------|
| **PR webhooks** | GitHub App not subscribed to `pull_request` events | Go to GitHub App settings → Permissions & events → subscribe to `pull_request` event |
| **Auto-review on PR open** | Depends on webhooks above | Fix webhook subscription |
| **Comment replies** (`/forkbot help` etc) | Needs `issue_comment` event subscribed | Fix webhook subscription |
| **GitHub Actions fallback** | Comment step disabled | Re-enable once webhooks work, or remove entirely |
| **Indexing** | Was auto-indexing all repos on install | ✅ Fixed — now on-demand only |

---

## How to Fix Webhooks (One-Time Setup)

The webhook delivery log shows only `push`, `check_suite`, and `installation` events — **no `pull_request` or `issue_comment` events**. This is why ForkBot never comments on PRs.

**Fix:** Go to **[https://github.com/settings/apps/forkbot-dev](https://github.com/settings/apps/forkbot-dev)** → **Permissions & events** → **Subscribe to events** and check:
- ✅ **Pull requests**
- ✅ **Issue comments**
- ✅ **Installation** (already subscribed)
- ✅ **Installation repositories**

Click **Save**. GitHub will start sending PR events to your Worker.

---

## Dashboard Sections

| Section | What it shows |
|---------|---------------|
| **Overview** | Stats: repos indexed, PRs reviewed, findings found. Recent review activity. |
| **Repositories** | All repos ForkBot is installed on. Trigger mode (auto/comment-only). Index button per repo. Search/filter. |
| **Reviews** | Run manual reviews by pasting a diff. See review history. Mark findings as helpful/false positive. |
| **Feedback** | False-positive rates per rule. Rule health stats. Which rules are auto-suppressed. |

---

## CLI Usage

```bash
# Review a diff locally
bun run review:demo

# Review from API
curl -X POST https://forkbot-api.oladapo.workers.dev/api/review/local \
  -H "Content-Type: application/json" \
  -d '{"repo":"owner/repo","prNumber":1,"diff":"..."}'
```

---

## Roadmap

1. **Fix webhook subscriptions** → PR auto-reviews work
2. **End-to-end test** → Open a PR, ForkBot comments as the GitHub App
3. **Comment command replies** → `/forkbot help`, `/forkbot describe` etc. work
4. **Improve review format** → Better markdown output, file-by-file breakdown
5. **Auto-fix suggestions** → `/forkbot fix <#>` generates and applies patches
6. **Dashboard improvements** → Better UX, real-time updates
