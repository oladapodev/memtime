# ForkBot Tasks

## Legend
- ✅ Done
- 🔵 Current / Next
- ⭕ Future
- 🚧 In Progress

---

## Phase 0: Foundation ✅

- [x] Replace rushed static scaffold with Bun monorepo.
- [x] Add core review engine and deterministic PR rules.
- [x] Add MemForks dry-run and SDK adapters.
- [x] Add GitHub App webhook crypto and API client.
- [x] Add Cloudflare Worker API, D1 schema, and Queue consumer.
- [x] Add React dashboard for local review/run inspection/promotion.
- [x] Add Bun CLI for review, API review, runs, and promote.
- [x] Add GitHub Action fallback workflow.
- [x] Add architecture documentation.

---

## Phase 1: Hosted API & GitHub App Webhook 🔵

- [x] Worker API code scaffolded with all routes
- [x] D1 schema migrations: 0001_initial, 0002_extend_schema, 0003_feedback
- [x] Queue producer/consumer for reviews + indexing
- [x] wrangler.jsonc configured with all bindings

### Deployment steps (NEXT):
- [ ] Create D1 database: `wrangler d1 create forkbot`
- [ ] Run migrations: `wrangler d1 migrations apply forkbot --remote`
- [ ] Create Queue: `wrangler queue create forkbot-jobs`
- [ ] Create Vectorize index: `wrangler vectorize create forkbot-codebase --dimensions 768 --metric cosine`
- [ ] Set secrets: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
- [ ] Set optional secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- [ ] Build & deploy: `bun run build:web && bun --cwd apps/api deploy`
- [ ] Create GitHub App in Developer Settings → set webhook URL
- [ ] Verify end-to-end: test PR → webhook → review → comment

---

## Phase 2: Dashboard & Onboarding ✅

- [x] Landing page with hero, CTAs, feature grid
- [x] GitHub OAuth login flow (`/api/auth/github`, `/callback`, `/session`)
- [x] Onboarding wizard (4 steps: repos → indexing → triggers → done)
- [x] Dashboard pages:
  - [x] Overview — stats cards, recent runs, quick actions
  - [x] Repositories — repo list with index button + progress bar
  - [x] Reviews — manual review form, run list, findings with feedback buttons
  - [x] Feedback Stats — rule health table, FP rates, recent feedback

---

## Phase 3: Codebase Indexing Engine ✅

- [x] `packages/indexer/` with 10 modules:
  - [x] `clone.ts` — GitHub Trees API fetcher (Worker-friendly, no git clone)
  - [x] `parser.ts` — Regex parser for JS/TS/Python/Rust/Go
  - [x] `graph.ts` — Dependency graph with import resolution
  - [x] `chunker.ts` — Semantic code chunking
  - [x] `embedder.ts` — Workers AI embeddings (bge-base-en-v1.5, 768-dim)
  - [x] `generator.ts` — AI generates 8 doc types
  - [x] `store.ts` — D1 + Vectorize storage adapter
  - [x] `incremental.ts` — Re-index only changed files on push
  - [x] `index.ts` — Orchestrator (clone → scan → parse → graph → chunk → embed → generate → store)
  - [x] `types.ts` — 9 shared types
- [x] Queue job: `IndexJob` with progress tracking
- [x] API routes: trigger index, get status, view docs
- [x] Dashboard: index button, status badge, progress bar, doc viewer

---

## Phase 4: AI Review Engine ✅

- [x] `packages/ai/` with 8 modules:
  - [x] `models.ts` — Model registry: Workers AI → OpenAI → Claude fallback chain
  - [x] `reviewer.ts` — AI review with codebase context injection + JSON parsing
  - [x] `suggester.ts` — Self-reflection scoring (1-10 heuristics), severity downgrade
  - [x] `fixer.ts` — Generate fix patches from findings
  - [x] `compressor.ts` — PR diff compression (split by file, token-aware, prioritize)
  - [x] `context-builder.ts` — Build rich context (docs + vector search + memory)
  - [x] `types.ts` — All AI-specific types
  - [x] `index.ts` — Unified exports

---

## Phase 5: Fix Pipeline & Sandbox ✅

- [x] `packages/sandbox/` with:
  - [x] `DryRunFixVerifier` — Structural validation (checks diff format, hunks)
  - [x] `SandboxFixVerifier` — Clone → apply patch → typecheck (via Sandbox SDK)
  - [x] `createFixVerifier` factory with config fallback
- [x] `POST /api/runs/:id/fix` — AI generates patch → sandbox verifies → stores result
- [x] Storage: `saveFixDiff`, `getFixesForRun`, `markFixApplied`
- [x] Dashboard: severity badges ready for "Apply Fix" button

---

## Phase 6: MCP Agent Handoff ✅

- [x] `packages/mcp/` with:
  - [x] JSON-RPC 2.0 protocol handler (session-based, SSE transport)
  - [x] `McpSession` class — routes `initialize`, `tools/list`, `tools/call`
  - [x] 7 MCP tools: `review_diff`, `get_findings`, `apply_fix`, `get_codebase_context`, `describe_changes`, `ask_question`, `promote_facts`
  - [x] Module-level session persistence (lazy init pattern)
- [x] API routes: `GET /mcp`, `POST /mcp/messages`
- [x] ~50 tests across all phases

---

## Phase 7: AI Improvement Loop (Feedback) ✅

- [x] `packages/feedback/` with:
  - [x] `analyzer.ts` — `updateRuleHealth`, `analyzeRuleHealth` (FP thresholds: 30% watch, 60% suppress), `analyzeAllRules`
- [x] Migration `0003_feedback.sql` — `finding_feedback`, `rule_health` tables
- [x] API routes: `POST /api/feedback`, `GET /api/feedback/stats`, `GET /api/runs/:id/findings`
- [x] Feedback UI: 👍/👎/⚡ buttons on each finding card
- [x] 59 tests passing

---

## Phase 8: Feedback Stats Dashboard ✅

- [x] `FeedbackStats.tsx` — Rule health table, FP rate bars, sortable columns, recent feedback list
- [x] Dashboard nav: "💬 Feedback" page
- [x] Color-coded status badges (Healthy ✅ / Watch ⚠️ / Suppressed 🚫)

---

## Phase 9: Trigger System ⭕

- [ ] Create `packages/trigger/`
  - [ ] Event dispatcher: route GitHub events by type
  - [ ] Trigger evaluator: check per-repo config
  - [ ] Comment command parser: `/forkbot review`, `@ForkBot`
- [ ] Trigger modes:
  - [ ] Auto (PR open + every commit)
  - [ ] Comment tag only
  - [ ] Custom: file filters, branch filters, label requirements
- [ ] Dashboard: trigger config page per repo

---

## Phase 10: Polish & Operations ⭕

- [ ] Wire `auto_suppressed` flag into deterministic rules engine
- [ ] Add cron job for periodic rule health analysis
- [ ] Add logging & observability
- [ ] Error reporting (dead letter queue, alerts)
- [ ] Dark mode for dashboard
- [ ] Keyboard shortcuts
- [ ] Demo video recording

---

## Future Ideas (More Tests + Features)

- **Integration tests:** End-to-end webhook → review → comment flow with a mock GitHub server
- **CLI tests:** Test the CLI with sample diffs and verify JSON output
- **Load tests:** Benchmark Workers AI latency under concurrent review requests
- **Real-time SSE streaming:** True MCP over SSE with persistent text/event-stream connection
- **Manual rule suppression:** Toggle to suppress/downgrade rules directly from Feedback Stats page
- **PR summary dashboard:** Show trend charts (findings over time, false positive rate trends)
- **Multi-language parsing:** Extend indexer parser for more languages (Java, Go, Ruby, PHP, C#)
