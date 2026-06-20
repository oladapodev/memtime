import type { JsonRpcRequest, JsonRpcResponse, McpToolDefinition, McpContext, McpSessionState } from "./types";

/**
 * MCP Session — manages a single client connection over SSE.
 * Routes JSON-RPC requests to the appropriate tool handlers.
 */
export class McpSession {
  private state: McpSessionState;
  private tools = new Map<string, McpToolDefinition>();

  constructor(
    id: string,
    repo: string,
    private ctx: McpContext,
  ) {
    this.state = {
      id,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      tools: [],
      repo,
    };
  }

  /** Register available tools */
  registerTools(toolList: McpToolDefinition[]): void {
    for (const tool of toolList) {
      this.tools.set(tool.name, tool);
    }
    this.state.tools = toolList.map((t) => t.name);
  }

  /** Handle a JSON-RPC request and return the response */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.state.lastActivity = Date.now();

    // MCP protocol methods
    switch (request.method) {
      case "initialize":
        return this.handleInitialize(request);
      case "tools/list":
        return this.handleListTools(request);
      case "tools/call":
        return this.handleToolCall(request);
      default:
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        };
    }
  }

  /** Handle MCP initialize request */
  private handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "0.1.0",
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: "ForkBot MCP Server",
          version: "1.0.0",
        },
      },
    };
  }

  /** Handle tools/list request — return available tool definitions */
  private handleListTools(request: JsonRpcRequest): JsonRpcResponse {
    const toolDefs = Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { tools: toolDefs },
    };
  }

  /** Handle tools/call request — invoke a specific tool */
  private async handleToolCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    const toolName = params?.name;
    const toolArgs = params?.arguments ?? {};

    if (!toolName) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32602, message: "Missing tool name" },
      };
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      };
    }

    try {
      const result = await tool.handler(toolArgs, this.ctx);
      return {
        jsonrpc: "2.0",
        id: request.id,
        result,
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /** Get current session state */
  getState(): McpSessionState {
    return { ...this.state };
  }
}
