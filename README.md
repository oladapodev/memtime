# ForkBot

ForkBot is a GitHub App PR reviewer backed by MemForks. Each pull request gets an isolated memory branch, so the reviewer can learn PR-specific context without polluting trusted repository memory. Maintainers promote only verified conventions back to `main`.

## Quick Demo

```bash
bun install
bun run review:demo
```

Run dashboard + API locally:

```bash
bun --cwd apps/web dev
bun --cwd apps/api dev
```

Open `http://localhost:5173`.

## Product Flow

1. GitHub sends PR webhook to `POST /webhooks/github`.
2. Worker verifies webhook signature and stores run in D1.
3. Queue worker fetches PR diff through GitHub App credentials.
4. ForkBot creates MemForks branch `pr/<owner-repo>/<number>` from `main`.
5. Review findings commit to PR memory branch.
6. Bot posts PR comment and check run.
7. Dashboard lets maintainer promote verified conventions back into `main`.

## Commands

```bash
forkbot review --diff patch.diff --repo owner/name --pr 123
forkbot review --github --repo owner/name --pr 123 --comment
forkbot api-review --api http://localhost:8787 --diff patch.diff --repo owner/name --pr 123
forkbot promote --repo owner/name --pr 123 --fact "server actions validate form data"
forkbot runs --api http://localhost:8787
```

## MemForks Setup

```bash
memfork init --quick
memfork doctor --env
```

Copy values into `.env` or Cloudflare secrets and set `FORKBOT_MEMFORK_ENABLED=true`.

## Docs

- Architecture: `docs/ARCHITECTURE.md`
- Implementation checklist: `TASKS.md`
