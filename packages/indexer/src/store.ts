import type { CodeChunk, EmbeddingResult, CodebaseDoc, IndexResult, IndexProgress } from "./types";

/**
 * Storage interface for the indexer that works in Workers.
 * Writes to D1 for docs + status, Vectorize for vectors, MemForks for long-term memory.
 */

export type IndexStorage = {
  /** Save indexing progress */
  saveProgress(repoId: string, status: IndexProgress): Promise<void>;
  /** Save final index result */
  saveResult(repoId: string, result: IndexResult): Promise<void>;

  /** Save generated docs to D1 */
  saveDocs(docs: CodebaseDoc[]): Promise<void>;
  /** Get generated docs for a repo */
  getDocs(repoId: string): Promise<CodebaseDoc[]>;

  /** Store vectors in Vectorize */
  storeVectors(
    vectorIndex: { upsert: (vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>) => Promise<unknown> },
    repoId: string,
    embeddings: EmbeddingResult[],
  ): Promise<void>;
  /** Search vectors by query embedding */
  searchVectors(
    vectorIndex: { query: (vector: number[], options: { topK: number; returnMetadata: boolean }) => Promise<{ matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> }> },
    repoId: string,
    queryVector: number[],
    topK: number,
  ): Promise<Array<{ id: string; score: number; filePath: string; context: string; contextName?: string; content?: string }>>;

  /** Update repo index_status in D1 */
  markRepoIndexed(repoId: string): Promise<void>;
  /** Mark repo index as failed */
  markRepoFailed(repoId: string, error: string): Promise<void>;
};

/**
 * Default D1-based storage implementation.
 */
export function createD1IndexStorage(
  db: {
    prepare: (sql: string) => {
      bind(...args: unknown[]): { run(): Promise<unknown>; first<T = unknown>(): Promise<T | null>; all<T = unknown>(): Promise<{ results: T[] }> };
      run(): Promise<unknown>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
  },
): IndexStorage {
  async function saveProgress(repoId: string, progress: IndexProgress): Promise<void> {
    const id = `index_${repoId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    await db
      .prepare(
        `INSERT INTO index_jobs (id, repo_id, status, step, progress)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
         status = excluded.status, step = excluded.step, progress = excluded.progress`,
      )
      .bind(id, repoId, progress.step, progress.step, progress.progress)
      .run();
  }

  async function saveResult(repoId: string, result: IndexResult): Promise<void> {
    const id = `index_${repoId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    await db
      .prepare(
        `INSERT INTO index_jobs (id, repo_id, status, step, progress, completed_at, error)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
         ON CONFLICT(id) DO UPDATE SET
         status = excluded.status, step = excluded.step, progress = excluded.progress,
         completed_at = CURRENT_TIMESTAMP, error = excluded.error`,
      )
      .bind(id, repoId, "completed", "done", 100, result.errors.length > 0 ? result.errors.join("; ") : null)
      .run();
  }

  async function saveDocs(docs: CodebaseDoc[]): Promise<void> {
    for (const doc of docs) {
      await db
        .prepare(
          `INSERT INTO codebase_docs (id, repo_id, doc_type, content, version)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(repo_id, doc_type) DO UPDATE SET
           content = excluded.content, version = excluded.version + 1,
           updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          `doc_${doc.repoId.replace(/[^a-zA-Z0-9]+/g, "_")}_${doc.docType}`,
          doc.repoId,
          doc.docType,
          doc.content,
          doc.version,
        )
        .run();
    }
  }

  async function getDocs(repoId: string): Promise<CodebaseDoc[]> {
    const result = await db
      .prepare("SELECT doc_type, content, version FROM codebase_docs WHERE repo_id = ? ORDER BY doc_type ASC")
      .bind(repoId)
      .all<{ doc_type: string; content: string; version: number }>();
    return result.results.map((r) => ({
      repoId,
      docType: r.doc_type as CodebaseDoc["docType"],
      content: r.content,
      version: r.version,
    }));
  }

  async function storeVectors(
    vectorIndex: { upsert: (vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>) => Promise<unknown> },
    repoId: string,
    embeddings: EmbeddingResult[],
  ): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize);
      await vectorIndex.upsert(
        batch.map((e) => ({
          id: `${repoId}_${e.chunkId}`,
          values: e.vector,
          metadata: {
            repoId,
            filePath: e.filePath,
            language: e.metadata.language,
            startLine: e.metadata.startLine,
            endLine: e.metadata.endLine,
            context: e.metadata.context,
            contextName: e.metadata.contextName ?? "",
          },
        })),
      );
    }
  }

  async function searchVectors(
    vectorIndex: { query: (vector: number[], options: { topK: number; returnMetadata: boolean }) => Promise<{ matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> }> },
    repoId: string,
    queryVector: number[],
    topK: number,
  ): Promise<Array<{ id: string; score: number; filePath: string; context: string; contextName?: string; content?: string }>> {
    const result = await vectorIndex.query(queryVector, { topK, returnMetadata: true });
    return result.matches
      .filter((m) => (m.metadata?.repoId as string) === repoId)
      .map((m) => ({
        id: m.id,
        score: m.score,
        filePath: (m.metadata?.filePath as string) ?? "",
        context: (m.metadata?.context as string) ?? "",
        contextName: (m.metadata?.contextName as string) ?? undefined,
      }));
  }

  async function markRepoIndexed(repoId: string): Promise<void> {
    await db
      .prepare("UPDATE repos SET index_status = 'indexed' WHERE full_name = ?")
      .bind(repoId)
      .run();
  }

  async function markRepoFailed(repoId: string, error: string): Promise<void> {
    await db
      .prepare("UPDATE repos SET index_status = 'failed' WHERE full_name = ?")
      .bind(repoId)
      .run();
  }

  return {
    saveProgress,
    saveResult,
    saveDocs,
    getDocs,
    storeVectors,
    searchVectors,
    markRepoIndexed,
    markRepoFailed,
  };
}
