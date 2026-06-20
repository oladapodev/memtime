// ─── JSON-RPC 2.0 Types ──────────────────────────────────────────

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
};

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
};

// ─── MCP Tool Definitions ────────────────────────────────────────

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (params: Record<string, unknown>, ctx: McpContext) => Promise<unknown>;
};

export type McpContext = {
  /** Repo full name */
  repo: string;
  /** GitHub installation token generator */
  getToken: () => Promise<string>;
  /** D1 Database */
  db: {
    prepare: (sql: string) => {
      bind(...args: unknown[]): {
        run(): Promise<unknown>;
        first<T = unknown>(): Promise<T | null>;
        all<T = unknown>(): Promise<{ results: T[] }>;
      };
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
  };
  /** AI binding */
  ai?: { run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>> };
  /** Vector index */
  vectorIndex?: {
    query: (vector: number[], options: { topK: number; returnMetadata: boolean }) => Promise<{ matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> }>;
  };
};

// ─── MCP Session ─────────────────────────────────────────────────

export type McpSessionState = {
  id: string;
  connectedAt: number;
  lastActivity: number;
  tools: string[];
  repo: string;
};
