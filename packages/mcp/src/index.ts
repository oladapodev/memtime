export { McpSession } from "./session";
export { allTools, reviewDiffTool, getFindingsTool, applyFixTool, getCodebaseContextTool, describeChangesTool, askQuestionTool, promoteFactsTool } from "./tools";
export type { McpToolDefinition, McpContext, JsonRpcRequest, JsonRpcResponse, JsonRpcError, McpSessionState } from "./types";

/**
 * MCP Server handler for Cloudflare Workers.
 * Handles SSE transport and message routing.
 */

import type { JsonRpcRequest } from "./types";
import { McpSession } from "./session";
import { allTools } from "./tools";
import type { McpContext } from "./types";

/**
 * Create MCP endpoints for a Worker fetch handler.
 * Returns handlers for GET (SSE setup) and POST (messages).
 *
 * NOTE: Sessions are stored in-memory. In production with multiple Worker
 * isolates, use a Durable Object for persistent session state. For the
 * current single-isolate dev setup, in-memory sessions work fine.
 */
export function createMcpHandlers(
  createContext: (repo?: string) => Promise<McpContext>,
) {
  const sessions = new Map<string, McpSession>();

  async function createSession(repo: string): Promise<{ sessionId: string; session: McpSession }> {
    const sessionId = crypto.randomUUID();
    const ctx = await createContext(repo);
    const session = new McpSession(sessionId, repo, ctx);
    session.registerTools(allTools);
    sessions.set(sessionId, session);
    return { sessionId, session };
  }

  function getSession(sessionId: string): McpSession | undefined {
    return sessions.get(sessionId);
  }

  async function handleSseGet(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const repo = url.searchParams.get("repo") ?? "unknown/repo";
    const { sessionId } = await createSession(repo);

    // Return SSE endpoint URL
    return new Response(
      JSON.stringify({
        endpoint: `/mcp/messages?session=${sessionId}`,
        sessionId,
        protocol: "0.1.0",
        serverInfo: { name: "ForkBot MCP Server", version: "1.0.0" },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  async function handleMcpPost(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session");
    if (!sessionId) {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Missing session" } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Session not found" } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const requestBody = (await request.json()) as JsonRpcRequest;
    const response = await session.handleRequest(requestBody);

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  /**
   * Main fetch handler for MCP routes.
   * Route to this from your Worker's fetch handler.
   */
  async function handleMcpRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" && request.method === "GET") {
      return handleSseGet(request);
    }

    if (url.pathname === "/mcp/messages" && request.method === "POST") {
      return handleMcpPost(request);
    }

    return null; // Not an MCP route
  }

  return { handleMcpRequest, sessions };
}
