import type { CodeChunk } from "./types";

/**
 * Generate vector embeddings for code chunks using Workers AI.
 * Each chunk is embedded with bge-base-en-v1.5 (768-dim vectors).
 */

export type EmbeddingResult = {
  chunkId: string;
  filePath: string;
  vector: number[];
  metadata: {
    language: string;
    startLine: number;
    endLine: number;
    context: string;
    contextName?: string;
  };
};

/**
 * Generate embeddings for a batch of code chunks.
 */
export async function generateEmbeddings(
  ai: { run: (model: string, inputs: { text: string[] }) => Promise<{ data: number[][] }> },
  chunks: CodeChunk[],
  repoId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  const batchSize = 16; // Workers AI batch limit

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => `File: ${c.filePath}\n${c.context === "function" ? `Function: ${c.contextName}\n` : ""}${c.context === "class" ? `Class: ${c.contextName}\n` : ""}${c.content.slice(0, 2000)}`);

    try {
      const response = await ai.run("@cf/baai/bge-base-en-v1.5", { text: texts });
      const vectors = response.data;

      for (let j = 0; j < batch.length; j++) {
        results.push({
          chunkId: batch[j].id,
          filePath: batch[j].filePath,
          vector: vectors[j],
          metadata: {
            language: batch[j].language,
            startLine: batch[j].startLine,
            endLine: batch[j].endLine,
            context: batch[j].context,
            contextName: batch[j].contextName,
          },
        });
      }
    } catch (error) {
      // If embedding fails for a batch, skip it
      console.error(`Embedding batch ${i} failed:`, error);
    }

    onProgress?.(results.length, chunks.length);
  }

  return results;
}

/**
 * Generate a single embedding for a text string (used for search queries).
 */
export async function generateQueryEmbedding(
  ai: { run: (model: string, inputs: { text: string[] }) => Promise<{ data: number[][] }> },
  query: string,
): Promise<number[]> {
  const response = await ai.run("@cf/baai/bge-base-en-v1.5", { text: [query.slice(0, 2000)] });
  return response.data[0];
}
