import type { ReviewContext } from "./types";

/**
 * Context builder input sources.
 */
export type ContextSources = {
  /** Repo full name (e.g. "owner/repo") */
  repoId: string;
  /** PR number */
  prNumber: number;
  /** PR title */
  prTitle: string;
  /** The raw diff */
  diff: string;
  /** Commit messages from the PR */
  commitMessages?: string[];
  /** Functions to fetch context from various sources */
  fetchers: {
    /** Get indexed codebase docs (ARCHITECTURE.md, CONVENTIONS.md, etc.) */
    getCodebaseDocs: () => Promise<Array<{ docType: string; content: string }>>;
    /** Search vectors for relevant chunks */
    searchVectors: (query: string, topK: number) => Promise<Array<{ filePath: string; score: number }>>;
    /** Get chunk content by file path */
    getChunkContent: (filePath: string) => Promise<string | null>;
    /** Get memory facts from MemForks */
    getMemoryFacts: (query: string) => Promise<string[]>;
  };
};

/**
 * Build rich context for AI review.
 * Fetches from multiple sources in parallel:
 * 1. Codebase docs (ARCHITECTURE, CONVENTIONS, etc.)
 * 2. Vector search (relevant code chunks)
 * 3. Memory facts (previously promoted conventions)
 */
export async function buildReviewContext(sources: ContextSources): Promise<ReviewContext> {
  const ctx: ReviewContext = {
    repoId: sources.repoId,
    prNumber: sources.prNumber,
    prTitle: sources.prTitle,
    architectureDocs: "",
    conventions: "",
    relevantChunks: [],
    memoryFacts: [],
    diff: sources.diff,
    commitMessages: sources.commitMessages ?? [],
  };

  try {
    const [docs, memoryFacts] = await Promise.all([
      sources.fetchers.getCodebaseDocs(),
      sources.fetchers.getMemoryFacts(
        `security auth cache data flow architecture conventions testing ${sources.prTitle}`,
      ),
    ]);

    ctx.memoryFacts = memoryFacts;

    // Extract architecture and conventions docs
    for (const doc of docs) {
      if (doc.docType === "ARCHITECTURE") ctx.architectureDocs = doc.content;
      if (doc.docType === "CONVENTIONS") ctx.conventions = doc.content;
    }

    // Vector search for relevant chunks
    try {
      const extractFilePaths = (diff: string): string[] => {
        const matches = diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm);
        return [...new Set([...matches].map((m) => m[2]))];
      };

      const changedFiles = extractFilePaths(sources.diff);
      const searchQueries = [
        sources.prTitle,
        ...changedFiles.map((f) => `file: ${f}`),
        "architecture patterns conventions",
      ];

      const seenPaths = new Set<string>();
      for (const query of searchQueries) {
        const results = await sources.fetchers.searchVectors(query, 5);
        for (const r of results) {
          if (!seenPaths.has(r.filePath) && r.score > 0.5) {
            seenPaths.add(r.filePath);
            const content = await sources.fetchers.getChunkContent(r.filePath);
            ctx.relevantChunks.push({
              filePath: r.filePath,
              content: content ?? "",
              score: r.score,
            });
          }
        }
      }

      // Sort by relevance score
      ctx.relevantChunks.sort((a, b) => b.score - a.score);
    } catch {
      // Vector search is optional — don't fail if unavailable
    }
  } catch {
    // Context building failures shouldn't block review
  }

  return ctx;
}

/**
 * Format context into a prompt string for the AI.
 * Prioritizes: architecture docs → conventions → relevant chunks → memory facts → diff
 */
export function formatContextForPrompt(ctx: ReviewContext): string {
  const parts: string[] = [];

  // Architecture docs
  if (ctx.architectureDocs) {
    // Truncate to avoid token overflow
    const truncated = ctx.architectureDocs.slice(0, 4000);
    parts.push(`<architecture>\n${truncated}\n</architecture>`);
  }

  // Conventions
  if (ctx.conventions) {
    const truncated = ctx.conventions.slice(0, 3000);
    parts.push(`<conventions>\n${truncated}\n</conventions>`);
  }

  // Relevant chunks
  if (ctx.relevantChunks.length > 0) {
    const chunks = ctx.relevantChunks
      .slice(0, 5)
      .map(
        (c) =>
          `File: ${c.filePath} (relevance: ${c.score.toFixed(2)})\n\`\`\`\n${c.content.slice(0, 1500)}\n\`\`\``,
      )
      .join("\n\n");
    parts.push(`<relevant_code>\n${chunks}\n</relevant_code>`);
  }

  // Memory facts
  if (ctx.memoryFacts.length > 0) {
    parts.push(`<trusted_knowledge>\n${ctx.memoryFacts.map((f) => `- ${f}`).join("\n")}\n</trusted_knowledge>`);
  }

  // Commit messages
  if (ctx.commitMessages.length > 0) {
    parts.push(`<commits>\n${ctx.commitMessages.map((m) => `- ${m}`).join("\n")}\n</commits>`);
  }

  // The diff
  parts.push(`<diff>\n${ctx.diff}\n</diff>`);

  return parts.join("\n\n");
}
