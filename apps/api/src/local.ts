import { promoteFacts, reviewPullRequest } from "../../../packages/core/src/index";
import { DryRunMemoryAdapter } from "../../../packages/memforks/src/index";

const memory = new DryRunMemoryAdapter();
const runs = new Map<string, unknown>();

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      ...init.headers,
    },
  });
}

const server = Bun.serve({
  port: Number(Bun.env.PORT ?? 8799),
  async fetch(request) {
    if (request.method === "OPTIONS") return json({ ok: true });
    const url = new URL(request.url);

    if (url.pathname === "/health") return json({ ok: true, service: "forkbot-local-api" });

    if (url.pathname === "/api/runs" && request.method === "GET") {
      return json([...runs.values()].map((run) => {
        const item = run as Record<string, unknown>;
        return {
          id: item.id,
          repo: item.repo,
          prNumber: item.prNumber,
          status: item.status,
          prBranch: item.prBranch,
          summary: item.summary,
          createdAt: item.createdAt,
          completedAt: item.completedAt,
        };
      }));
    }

    if (url.pathname.startsWith("/api/runs/") && request.method === "GET") {
      const id = url.pathname.split("/")[3];
      return runs.has(id) ? json(runs.get(id)) : json({ error: "run not found" }, { status: 404 });
    }

    if (url.pathname.endsWith("/promote") && request.method === "POST") {
      const id = url.pathname.split("/")[3];
      const run = runs.get(id) as Record<string, unknown> | undefined;
      if (!run) return json({ error: "run not found" }, { status: 404 });
      const body = (await request.json()) as { facts?: string[] };
      const event = await promoteFacts(String(run.repo), Number(run.prNumber), body.facts ?? [], memory);
      const events = Array.isArray(run.memoryEvents) ? run.memoryEvents : [];
      run.memoryEvents = [...events, event];
      runs.set(id, run);
      return json(event);
    }

    if (url.pathname === "/api/review/local" && request.method === "POST") {
      const body = (await request.json()) as { repo?: string; prNumber?: number; diff?: string; title?: string };
      const result = await reviewPullRequest(
        {
          repo: body.repo ?? "local/repo",
          prNumber: body.prNumber ?? 1,
          diff: body.diff ?? "",
          title: body.title,
        },
        memory,
      );
      const id = `run_${crypto.randomUUID().replaceAll("-", "")}`;
      const record = {
        id,
        status: "completed",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        ...result,
      };
      runs.set(id, record);
      return json(record);
    }

    return json({ error: "not found" }, { status: 404 });
  },
});

console.log(`ForkBot local API: http://localhost:${server.port}`);
