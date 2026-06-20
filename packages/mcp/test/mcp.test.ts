import { describe, expect, test } from "bun:test";
import { McpSession } from "../src/session";
import { allTools, reviewDiffTool, describeChangesTool } from "../src/tools";
import type { JsonRpcRequest, JsonRpcResponse, McpContext } from "../src/types";

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,8 @@ export function verify(token) {
   if (!token) throw new Error("no token");
+  const version = await cache.get(\`token:version:\${token}\`);
+  if (version && version !== currentVersion) throw new Error("token revoked");
   return jwt.verify(token, SECRET);
 }`;

describe("McpSession", () => {
  const mockCtx: McpContext = {
    repo: "test/repo",
    getToken: async () => "mock-token",
    db: {
      prepare: () => ({
        bind: () => ({
          run: async () => {},
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    },
  };

  test("handles initialize request", async () => {
    const session = new McpSession("test-1", "test/repo", mockCtx);
    session.registerTools(allTools);

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    };

    const response = await session.handleRequest(request);
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    const result = response.result as { serverInfo: { name: string } };
    expect(result.serverInfo.name).toBe("ForkBot MCP Server");
  });

  test("lists tools", async () => {
    const session = new McpSession("test-2", "test/repo", mockCtx);
    session.registerTools(allTools);

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    };

    const response = await session.handleRequest(request);
    const result = response.result as { tools: unknown[] };
    expect(result.tools).toBeDefined();
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);
    // Should include review_diff
    const toolNames = result.tools.map((t) => (t as { name: string }).name);
    expect(toolNames).toContain("review_diff");
    expect(toolNames).toContain("get_findings");
    expect(toolNames).toContain("describe_changes");
  });

  test("handles unknown method", async () => {
    const session = new McpSession("test-3", "test/repo", mockCtx);

    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "unknown_method",
    };

    const response = await session.handleRequest(request);
    expect(response.error?.code).toBe(-32601);
  });

  test("reports session state", async () => {
    const session = new McpSession("test-4", "test/repo", mockCtx);
    session.registerTools(allTools);

    const state = session.getState();
    expect(state.id).toBe("test-4");
    expect(state.repo).toBe("test/repo");
    expect(state.tools.length).toBeGreaterThan(0);
    expect(state.connectedAt).toBeGreaterThan(0);
  });
});

describe("MCP Tools", () => {
  test("review_diff returns compressed diff summary", async () => {
    const result = await reviewDiffTool.handler(
      { diff: SAMPLE_DIFF, repo: "test/repo", prNumber: 1 },
      {} as McpContext,
    ) as { filesChanged: number; summary: string };

    expect(result.filesChanged).toBe(1);
    expect(result.summary).toContain("file(s) changed");
  });

  test("describe_changes returns file descriptions", async () => {
    const result = await describeChangesTool.handler(
      { diff: SAMPLE_DIFF },
      {} as McpContext,
    ) as { files: string[] };

    expect(result.files.length).toBe(1);
    expect(result.files[0]).toContain("src/auth.ts");
  });

  test("review_diff handles empty diff", async () => {
    const result = await reviewDiffTool.handler(
      { diff: "", repo: "test/repo" },
      {} as McpContext,
    ) as { filesChanged: number; summary: string };

    expect(result.filesChanged).toBe(0);
    expect(result.summary).toBe("No changes detected.");
  });
});
