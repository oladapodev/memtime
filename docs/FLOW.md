# ForkBot Flow

## The One Sentence

ForkBot lives on **Cloudflare**. It listens for GitHub events, reviews PRs using AI, posts results back to GitHub, and exposes an MCP endpoint for AI coding agents to use directly.

---

## How a PR Gets Reviewed

```
GitHub                              Cloudflare (forkbot.dev)
──────                              ─────────────────────────

1. Someone opens a PR
   │
   ├──► POST /webhooks/github
   │    Event: pull_request: opened
   │    Payload: { repo, pr number, changes }
   │
   │    ┌────────────────────────────────────────────┐
   │    │  WEBHOOK HANDLER                           │
   │    │  • Verify signature (X-Hub-Signature-256)  │
   │    │  • Store PR info in D1                     │
   │    │  • Create a RunRecord                      │
   │    │  • Push ReviewJob to Queue                 │
   │    │  • Return 200 OK to GitHub                 │
   │    └──────────────────┬─────────────────────────┘
   │                       │
   │    ┌──────────────────▼─────────────────────────┐
   │    │  QUEUE WORKER (forkbot-review)              │
   │    │                                            │
   │    │  1. Fetch PR diff from GitHub API           │
   │    │  2. Recall codebase context from MemForks   │
   │    │     (ARCHITECTURE.md, CONVENTIONS.md, etc.)│
   │    │  3. Run AI review (Workers AI)              │
   │    │  4. Self-reflect & score findings           │
   │    │  5. Commit findings to MemForks PR branch   │
   │    │  6. Post comment on PR with findings        │
   │    │  7. Create check run (pass/fail)            │
   │    │  8. Save everything to D1                   │
   │    └────────────────────────────────────────────┘
   │
   │    GitHub PR page now shows:
   │    ┌──────────────────────────────────────┐
   │    │  🛡️ ForkBot — All checks passed    │
   │    │                                      │
   │    │  🔴 HIGH: Auth cache misses revo... │
   │    │  🟡 MEDIUM: No tests detected       │
   │    │                                      │
   │    │  [Apply Fix] [View Dashboard]        │
   │    └──────────────────────────────────────┘

2. Someone clicks "Apply Fix"
   │
   ├──► POST /api/runs/:id/fix/:findingId
   │
   │    ┌────────────────────────────────────────────┐
   │    │  FIX GENERATOR                             │
   │    │  • AI generates a diff patch               │
   │    │  • Sandbox verifies (typecheck/lint)       │
   │    │  • Returns patch + confidence score        │
   │    └────────────────────────────────────────────┘
   │
   │    User approves → ForkBot commits to PR

3. Someone tags the bot in a PR comment
   │
   ├──► Comment: "/forkbot review"
   │
   │    ┌────────────────────────────────────────────┐
   │    │  Bot responds:                             │
   │    │  • Same review pipeline                    │
   │    │  • Posts findings as reply                 │
   │    └────────────────────────────────────────────┘
```

---

## How AI Agents (like Codebuff) Use ForkBot

```
AI Agent (Codebuff, Claude Code, Cursor, etc.)
         │
         │  Connect: https://forkbot.dev/mcp
         ▼
┌──────────────────────────────────────────────┐
│  Durable Object: MCP Session                 │
│  ───────────────────────────                 │
│  • One DO per connected agent                │
│  • Session persists across calls             │
│  • Hibernates when idle (zero cost)          │
│  • Wakes instantly on next call              │
│                                              │
│  Tools the agent can call:                   │
│                                              │
│  review_diff(diff, repo, pr)                 │
│    → ForkBot reviews, returns findings       │
│                                              │
│  get_findings(run_id)                        │
│    → Returns structured findings array       │
│                                              │
│  apply_fix(finding_id)                       │
│    → Returns verified fix patch              │
│                                              │
│  get_codebase_context(repo)                  │
│    → Returns ARCHITECTURE.md, FILES.md, etc. │
│                                              │
│  describe_changes(diff)                      │
│    → Returns natural language description    │
│                                              │
│  ask_question(question, run_id)              │
│    → Returns AI answer about the PR          │
│                                              │
│  promote_facts(run_id, facts[])              │
│    → Promotes conventions to MemForks main   │
└──────────────────────────────────────────────┘

Example — I (Codebuff) use ForkBot while coding with you:

  You: "Review this diff before I push"

  Me:  → calls review_diff({ diff, repo: "your/repo" })
       → ForkBot returns findings
       → I show them to you

  You: "Apply fix #3"

  Me:  → calls apply_fix({ finding_id: "3" })
       → ForkBot returns a patch
       → I apply it to your code
```

---

## How the CLI Works

The CLI is just **a thin wrapper** that calls ForkBot's hosted API. Like `gh` is for GitHub.

```
# Install once:
npm install -g @forkbot/cli

# Authenticate:
forkbot login
  → Prompts for ForkBot API token (from dashboard settings)

# Then use it to call the hosted ForkBot:
forkbot review --diff patch.diff         # review a local diff
forkbot review --pr 42 --repo owner/repo  # review a GitHub PR
forkbot fix --last --finding 3            # fix finding #3 from last run
forkbot describe --diff patch.diff        # describe a diff
forkbot runs                              # list recent runs
forkbot promote --pr 42 --fact "..."      # promote a convention
```

The CLI never runs AI locally. Every command calls `https://forkbot.dev/api/...` and returns the result.

---

## Trigger System

Configure per-repo from the dashboard:

| Mode | When ForkBot Reviews |
|------|----------------------|
| **Auto (default)** | On PR open and every new commit |
| **Comment tag only** | Only when someone comments `/forkbot review` or `@ForkBot` |
| **Custom** | Any combination of events + filters |

Filter options: file paths, branch names, min changes, skip drafts, require labels.

---

### Comment Commands

Anyone can use these in a PR comment:

```
/forkbot review           — Trigger review
/forkbot fix <#>          — Generate fix for finding #
/forkbot describe         — Describe what the PR does
/forkbot ask <question>   — Ask about the PR
/forkbot promote <facts>  — Save convention permanently
/forkbot status           — Check review status
/forkbot help             — Show commands
@ForkBot review           — Same as /forkbot review
```

---

## Onboarding (One-Time Setup)

```
1. Go to forkbot.dev → click "Install ForkBot"
2. GitHub App install page → select repos → Install
3. Redirected back to dashboard → OAuth login (click "Authorize")
4. Dashboard shows your repos with indexing status
5. Click "Index" on any repo → ForkBot scans it (clones via GitHub API)
6. AI generates: ARCHITECTURE.md, FILES.md, DOMAIN.md, CONVENTIONS.md
7. Configure triggers (or leave default auto-mode)
8. Done — ForkBot now reviews every PR on those repos
```

---

## Architecture Diagram (Simplified)

```
                         ┌──────────────────┐
                         │   GitHub          │
                         │   (App + OAuth)   │
                         └──┬──────┬───────┘
                            │      │
                   webhooks │      │ API calls
                            │      │
                            ▼      ▼
┌─────────────────────────────────────────────────────┐
│                 Cloudflare Worker                    │
│                                                      │
│  /webhooks/github     /api/*          /mcp           │
│  (receives events)   (REST API)    (MCP endpoint)   │
│        │                │              │             │
│        ▼                ▼              ▼             │
│  ┌──────────┐   ┌────────────┐  ┌────────────────┐  │
│  │  Event   │   │  API       │  │  Durable Object│  │
│  │  Router  │   │  Handlers  │  │  (MCP Session) │  │
│  └────┬─────┘   └────────────┘  └────────────────┘  │
│       │                                               │
│       ▼                                               │
│  ┌────────────────────────────────────────────────┐   │
│  │              Cloudflare Queue                   │   │
│  │  ReviewJob · IndexJob · FixJob · PromoteJob     │   │
│  └───────────────────────┬────────────────────────┘   │
│                          │                            │
│                          ▼                            │
│  ┌────────────────────────────────────────────────┐   │
│  │              Queue Consumer                     │   │
│  │  ┌──────────┐ ┌────────┐ ┌──────────────────┐  │   │
│  │  │ MemForks │ │Workers │ │ Sandbox SDK      │  │   │
│  │  │ (memory) │ │(AI)    │ │ (code execution) │  │   │
│  │  └──────────┘ └────────┘ └──────────────────┘  │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌────────────────────────────────────────────────┐   │
│  │              D1 Database                        │   │
│  │  installations · repos · runs · findings       │   │
│  │  fix_diffs · codebase_docs · mcp_sessions      │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
│  ┌────────────────────────────────────────────────┐   │
│  │              Dashboard (React SPA)              │   │
│  │  Overview · Repos · Reviews · Docs · Settings  │   │
│  └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Data Tables

```
installations    — GitHub App installs (id, account, github_installation_id)
repos            — Repos with index status, trigger config
pull_requests    — PRs (number, title, head/base sha, state)
review_runs      — Each review (status, pr_branch, summary, markdown)
findings         — Individual findings (severity, file, line, suggestion)
fix_diffs        — Generated fix patches (patch text, confidence, verified)
memory_events    — MemForks operations (branch, commit, promote)
codebase_docs    — Generated docs (ARCHITECTURE.md, FILES.md, etc.)
mcp_sessions     — Active MCP agent connections
trigger_configs  — Per-repo trigger settings
```
