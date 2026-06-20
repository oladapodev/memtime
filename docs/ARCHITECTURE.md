# ForkBot Architecture

## One-Liner

ForkBot is a hosted Cloudflare Worker that receives GitHub webhooks, reviews PRs using AI, posts results back, and exposes an MCP endpoint for AI coding agents.

---

## Stack

| Service | What It Does |
|---------|---------------|
| **Workers** | API gateway, webhook handler, queue consumer, MCP server |
| **Durable Objects** | Stateful MCP sessions per connected AI agent |
| **Queues** | Async processing of reviews, indexing, fixes |
| **D1** | SQLite database for runs, findings, repos, docs |
| **Workers AI** | LLM inference for reviews, fix generation, doc generation |
| **Sandbox SDK** | Isolated containers to verify fix patches compile |
| **MemForks** | Version-controlled memory per PR branch |
| **Vectorize** | Vector search over codebase chunks for context retrieval |
| **Agents SDK** | `McpAgent` class for MCP protocol implementation |

---

## Workers

### `apps/api` — Main Worker (forkbot.dev)

| Route | What |
|-------|------|
| `POST /webhooks/github` | Receive all GitHub events (PR, push, comment, install) |
| `GET /api/runs` | List review runs |
| `GET /api/runs/:id` | Run detail + findings |
| `POST /api/runs/:id/fix/:findingId` | Generate a verified fix |
| `POST /api/runs/:id/promote` | Promote conventions to MemForks main |
| `GET /api/repos` | List repos + index status |
| `POST /api/repos/:id/index` | Trigger codebase indexing |
| `GET /api/repos/:id/docs` | Get generated codebase docs |
| `PUT /api/repos/:id/trigger` | Configure trigger settings |
| `GET /api/auth/github` | OAuth login |
| `GET /api/auth/callback` | OAuth callback |
| `GET /api/auth/session` | Session info |
| `GET /` | Dashboard (React SPA) |
| `/mcp` | MCP endpoint for AI agents (SSE) |

### `apps/mcp` — MCP Handler (same Worker, separate DO namespace)

| MCP Tool | What It Does |
|----------|-------------|
| `review_diff` | Submit diff → AI review → structured findings |
| `get_findings` | Get findings for a run |
| `apply_fix` | Generate + sandbox-verify a fix patch |
| `get_codebase_context` | Return indexed docs (ARCHITECTURE.md etc.) |
| `describe_changes` | Natural language diff description |
| `ask_question` | Q&A about a PR with codebase context |
| `promote_facts` | Promote conventions to MemForks main |

Each MCP session is a **Durable Object** — stateful, hibernates when idle, wakes on next call. Zero cost between calls.

---

## Packages

### `packages/core` — Review Pipeline

```
PR Diff
  │
  ▼
1. Compress & chunk (PR-Agent strategy)
2. Recall codebase context from MemForks (ARCHITECTURE.md etc.)
3. Recall vector embeddings from Vectorize (semantic search)
4. Run AI review (Workers AI → fallback: OpenAI/Claude)
5. Self-reflect: score & filter findings (1-10 scale)
6. Run deterministic rules (complementary to AI)
7. Commit findings to MemForks PR branch
8. Generate markdown for GitHub comment
```

### `packages/ai` — AI Models

| Tier | Model | Use |
|------|-------|-----|
| Primary | `@cf/meta/llama-4-scout` (Workers AI) | Fast reviews, suggestions |
| Fallback | OpenAI GPT-4o (via AI Gateway) | Complex analysis, fixes |
| Embedding | `@cf/baai/bge-base-en-v1.5` | Semantic code search |

### `packages/indexer` — Codebase Indexing

When a repo is installed:
1. Clone via GitHub App token (shallow)
2. Scan all files, parse exports/types/functions
3. Build dependency graph
4. Generate vector embeddings per chunk
5. AI generates 8 docs: `ARCHITECTURE.md`, `FILES.md`, `DOMAIN.md`, `CONVENTIONS.md`, `API.md`, `DB_SCHEMA.md`, `DEPLOYMENT.md`, `GLOSSARY.md`
6. Store in MemForks `index/<org>/<repo>/main`
7. Incremental updates on push (only re-index changed files)

### `packages/sandbox` — Code Verification

When a fix is generated:
1. Launch isolated container (Sandbox SDK)
2. Clone PR branch + apply patch
3. Run typecheck/lint/build
4. Return pass/fail + logs

### `packages/trigger` — Event Dispatcher

Routes GitHub events to handlers based on per-repo config:

```
GitHub event → Event Dispatcher → Trigger Evaluator
                                   → Match config? → Enqueue job
                                   → No match? → Return 200, ignored
```

---

## Data Flow

### PR Review (Webhook → Comment)
```
1. GitHub: pull_request: opened
2. Worker: verify signature, store PR, enqueue ReviewJob
3. Queue: fetch PR diff via GitHub API
4. Queue: recall MemForks context for the repo
5. Queue: run AI review (Workers AI)
6. Queue: self-reflect & score findings
7. Queue: commit to MemForks PR branch
8. Worker: post comment on PR
9. Worker: create check run
```

### Fix Generation (Dashboard/MCP → Patch)
```
1. User clicks "Apply Fix" on a finding
2. Worker: load run + finding from D1
3. Worker: load current file from GitHub
4. AI: generate fix patch
5. Sandbox: verify patch compiles
6. Return: { patch, confidence, verified, log }
7. User approves → worker pushes patch to PR
```

### MCP Agent Handoff
```
1. AI agent connects to /mcp (SSE)
2. Durable Object creates session
3. Agent calls review_diff() with a diff
4. DO enqueues review → Queue processes → results streamed back
5. Agent calls apply_fix() → gets patch back
6. Agent applies patch locally
7. Session hibernates between calls (zero cost)
```

---

## Failure Modes

| Failure | Handling |
|---------|----------|
| GitHub API down | Queue retries with backoff |
| LLM rate limited | Fallback model (Workers AI → OpenAI → Claude) |
| MemForks error | Fall back to DryRunMemoryAdapter |
| Fix doesn't compile | Return fix with "unverified" flag + sandbox logs |
| Queue poison message | Dead letter queue after 3 retries |
