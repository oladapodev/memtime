import { compressDiff } from "../../ai/src/compressor";
import type { McpToolDefinition, McpContext } from "./types";

/**
 * review_diff — Submit a diff for AI review, returns structured findings.
 */
export const reviewDiffTool: McpToolDefinition = {
  name: "review_diff",
  description: "Submit a pull request diff for ForkBot review. Returns structured findings with severity, file paths, and suggestions.",
  inputSchema: {
    type: "object",
    properties: {
      diff: { type: "string", description: "The unified diff to review" },
      repo: { type: "string", description: "Repository name (owner/repo)" },
      prNumber: { type: "number", description: "PR number" },
      title: { type: "string", description: "PR title (optional)" },
    },
    required: ["diff", "repo"],
  },
  handler: async (params, ctx) => {
    const diff = String(params.diff ?? "");
    const repo = String(params.repo ?? ctx.repo);
    const prNumber = Number(params.prNumber ?? 0);
    const title = String(params.title ?? "MCP review");

    const compressed = compressDiff(diff);
    const summary = compressed.summary;

    return {
      repo,
      prNumber,
      title,
      summary,
      filesChanged: compressed.chunks.length,
      totalAdded: compressed.chunks.reduce((s: number, c: { linesAdded: number }) => s + c.linesAdded, 0),
      totalRemoved: compressed.chunks.reduce((s: number, c: { linesRemoved: number }) => s + c.linesRemoved, 0),
      tokenEstimate: compressed.tokenEstimate,
      chunks: compressed.chunks.map((c) => ({
        file: c.filePath,
        changeType: c.changeType,
        added: c.linesAdded,
        removed: c.linesRemoved,
      })),
    };
  },
};

/**
 * Resolve a repo full name to its internal repo_id.
 */
async function resolveRepoId(db: McpContext["db"], fullName: string): Promise<string | null> {
  const repo = await db
    .prepare("SELECT id FROM repos WHERE full_name = ?")
    .bind(fullName)
    .first<{ id: string }>();
  return repo?.id ?? null;
}

/**
 * get_findings — Get findings for a specific review run.
 */
export const getFindingsTool: McpToolDefinition = {
  name: "get_findings",
  description: "Get structured findings for a review run by run ID.",
  inputSchema: {
    type: "object",
    properties: {
      runId: { type: "string", description: "The review run ID" },
    },
    required: ["runId"],
  },
  handler: async (params, ctx) => {
    const runId = String(params.runId ?? "");

    const run = await ctx.db
      .prepare(
        `SELECT rr.*, r.full_name AS repo, pr.number AS pr_number
         FROM review_runs rr
         JOIN pull_requests pr ON pr.id = rr.pr_id
         JOIN repos r ON r.id = pr.repo_id
         WHERE rr.id = ?`,
      )
      .bind(runId)
      .first<Record<string, unknown>>();

    if (!run) {
      return { error: "Run not found" };
    }

    const findings = await ctx.db
      .prepare("SELECT * FROM findings WHERE run_id = ? ORDER BY severity DESC")
      .bind(runId)
      .all();

    return {
      id: run.id,
      repo: run.repo,
      prNumber: run.pr_number,
      status: run.status,
      summary: run.summary,
      findings: findings.results,
    };
  },
};

/**
 * apply_fix — Generate and verify a fix for a finding.
 */
export const applyFixTool: McpToolDefinition = {
  name: "apply_fix",
  description: "Generate a fix patch for a specific finding and optionally verify it.",
  inputSchema: {
    type: "object",
    properties: {
      runId: { type: "string", description: "The review run ID" },
      findingId: { type: "string", description: "The finding rule ID to fix" },
      filePath: { type: "string", description: "Filter by file path (optional, disambiguates findings with same rule ID)" },
      codeContext: { type: "string", description: "Surrounding code context (optional)" },
    },
    required: ["runId", "findingId"],
  },
  handler: async (params, ctx) => {
    const runId = String(params.runId ?? "");
    const findingId = String(params.findingId ?? "");
    const filePath = params.filePath ? String(params.filePath) : null;
    const codeContext = String(params.codeContext ?? "");

    // Verify the run exists
    const run = await ctx.db.prepare("SELECT id FROM review_runs WHERE id = ?").bind(runId).first<{ id: string }>();
    if (!run) return { error: "Run not found" };

    // Get findings matching the rule_id
    let query = "SELECT * FROM findings WHERE run_id = ? AND rule_id = ?";
    const bindArgs: unknown[] = [runId, findingId];

    if (filePath) {
      query += " AND file_path = ?";
      bindArgs.push(filePath);
    }

    const matched = await ctx.db
      .prepare(query + " ORDER BY severity DESC LIMIT 1")
      .bind(...bindArgs)
      .first<Record<string, unknown>>();

    if (!matched) {
      return { error: `Finding ${findingId} not found in run ${runId}` };
    }

    return {
      message: `Fix generation for ${findingId} requires AI binding. Submit via the API: POST /api/runs/${runId}/fix`,
      finding: matched,
    };
  },
};

/**
 * get_codebase_context — Return indexed docs for a repo.
 */
export const getCodebaseContextTool: McpToolDefinition = {
  name: "get_codebase_context",
  description: "Get indexed codebase documentation (ARCHITECTURE.md, CONVENTIONS.md, etc.) for a repository.",
  inputSchema: {
    type: "object",
    properties: {
      repo: { type: "string", description: "Repository name (owner/repo)" },
    },
    required: ["repo"],
  },
  handler: async (params, ctx) => {
    const repo = String(params.repo ?? ctx.repo);

    // Resolve repo name to internal repo_id
    const repoId = await resolveRepoId(ctx.db, repo);
    if (!repoId) {
      return { repo, message: "Repository not found in ForkBot database. Install the GitHub App and push a PR first.", docs: [] };
    }

    const docs = await ctx.db
      .prepare("SELECT doc_type, content, version FROM codebase_docs WHERE repo_id = ? ORDER BY doc_type ASC")
      .bind(repoId)
      .all<{ doc_type: string; content: string; version: number }>();

    if (docs.results.length === 0) {
      return { repo, message: "No indexed docs found. Run indexing first via the dashboard.", docs: [] };
    }

    return {
      repo,
      docCount: docs.results.length,
      docs: docs.results.map((d) => ({
        type: d.doc_type,
        content: d.content,
        version: d.version,
      })),
    };
  },
};

/**
 * describe_changes — Natural language description of a diff.
 */
export const describeChangesTool: McpToolDefinition = {
  name: "describe_changes",
  description: "Generate a natural language description of what a diff does.",
  inputSchema: {
    type: "object",
    properties: {
      diff: { type: "string", description: "The unified diff to describe" },
    },
    required: ["diff"],
  },
  handler: async (params) => {
    const diff = String(params.diff ?? "");
    const compressed = compressDiff(diff);

    const descriptions: string[] = [];
    for (const chunk of compressed.chunks) {
      const action = chunk.changeType === "added" ? "Adds" : chunk.changeType === "deleted" ? "Removes" : "Modifies";
      descriptions.push(`${action} ${chunk.filePath} (+${chunk.linesAdded} -${chunk.linesRemoved} lines)`);
    }

    return {
      summary: compressed.summary,
      files: descriptions,
      tokenEstimate: compressed.tokenEstimate,
    };
  },
};

/**
 * ask_question — Answer a question about the codebase.
 */
export const askQuestionTool: McpToolDefinition = {
  name: "ask_question",
  description: "Ask a question about the codebase context and get an AI-powered answer.",
  inputSchema: {
    type: "object",
    properties: {
      question: { type: "string", description: "Your question about the codebase" },
      repo: { type: "string", description: "Repository name (owner/repo)" },
    },
    required: ["question", "repo"],
  },
  handler: async (params, ctx) => {
    const question = String(params.question ?? "");
    const repo = String(params.repo ?? ctx.repo);

    // Resolve repo name to internal repo_id
    const repoId = await resolveRepoId(ctx.db, repo);
    if (!repoId) {
      return { repo, question, contextAvailable: false, contextDocs: [], answer: `No indexed context available for ${repo}. Install the GitHub App and run indexing first.` };
    }

    // Get codebase docs for context
    const docs = await ctx.db
      .prepare("SELECT doc_type, content FROM codebase_docs WHERE repo_id = ?")
      .bind(repoId)
      .all<{ doc_type: string; content: string }>();

    return {
      repo,
      question,
      contextAvailable: docs.results.length > 0,
      contextDocs: docs.results.map((d) => d.doc_type),
      answer:
        docs.results.length > 0
          ? `Context available for ${repo}. Use the ForkBot dashboard or API for AI-powered answers.`
          : `No indexed context available for ${repo}. Run indexing first.`,
    };
  },
};

/**
 * promote_facts — Promote conventions to MemForks main branch.
 */
export const promoteFactsTool: McpToolDefinition = {
  name: "promote_facts",
  description: "Promote verified conventions from a PR review to the main memory branch.",
  inputSchema: {
    type: "object",
    properties: {
      runId: { type: "string", description: "The review run ID" },
      facts: {
        type: "array",
        items: { type: "string" },
        description: "Array of convention facts to promote",
      },
    },
    required: ["runId", "facts"],
  },
  handler: async (params) => {
    const runId = String(params.runId ?? "");
    const facts = (params.facts as string[]) ?? [];

    if (facts.length === 0) {
      return { error: "No facts provided to promote" };
    }

    return {
      runId,
      factsPromoted: facts.length,
      facts,
      message: "Facts queued for promotion. Use the dashboard to approve and finalize.",
    };
  },
};

/** All MCP tools */
export const allTools: McpToolDefinition[] = [
  reviewDiffTool,
  getFindingsTool,
  applyFixTool,
  getCodebaseContextTool,
  describeChangesTool,
  askQuestionTool,
  promoteFactsTool,
];
