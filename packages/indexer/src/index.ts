export { fetchRepoTree, fetchFileContent, fetchRepoLanguages, filterFiles, isIgnored, isSupported } from "./clone";
export { parseFile } from "./parser";
export { buildDependencyGraph, findDependents } from "./graph";
export { generateChunks } from "./chunker";
export { generateEmbeddings, generateQueryEmbedding } from "./embedder";
export { generateCodebaseDocs } from "./generator";
export { createD1IndexStorage } from "./store";
export { detectChangedFiles, computeReindexList } from "./incremental";
export type {
  ParsedFile,
  DependencyGraph,
  DependencyEdge,
  CodeChunk,
  CodebaseDoc,
  IndexResult,
  IndexProgress,
  EmbeddingResult,
} from "./types";

import { fetchRepoTree, fetchFileContent, filterFiles } from "./clone";
import { parseFile } from "./parser";
import { buildDependencyGraph } from "./graph";
import { generateChunks } from "./chunker";
import { generateEmbeddings } from "./embedder";
import { generateCodebaseDocs } from "./generator";
import type { IndexStorage } from "./store";
import type { IndexResult, IndexProgress } from "./types";

export type IndexEnvironment = {
  /** GitHub App token generator */
  githubToken: () => Promise<string>;
  /** Workers AI binding */
  ai: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  /** Vectorize index binding */
  vectorIndex: {
    upsert: (vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>) => Promise<unknown>;
    query: (
      vector: number[],
      options: { topK: number; returnMetadata: boolean },
    ) => Promise<{ matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> }>;
  };
  /** Storage backend */
  storage: IndexStorage;
};

/**
 * Run a full indexing pipeline for a repo.
 * Orchestrates: clone → scan → parse → graph → chunk → embed → generate docs → store
 */
export async function runIndex(
  repoId: string,
  repoUrl: string,
  defaultBranch: string,
  env: IndexEnvironment,
  onProgress?: (p: IndexProgress) => void,
): Promise<IndexResult> {
  const result: IndexResult = {
    repoId,
    repoUrl,
    defaultBranch,
    filesScanned: 0,
    filesParsed: 0,
    chunksGenerated: 0,
    embeddingsGenerated: 0,
    docsGenerated: 0,
    errors: [],
  };

  try {
    // Step 1: Clone (fetch tree from GitHub API)
    onProgress?.({ step: "scanning", progress: 5, message: "Fetching repository tree..." });
    await env.storage.saveProgress(repoId, { step: "scanning", progress: 5, message: "Fetching tree" });

    const allItems = await fetchRepoTree(env.githubToken, repoId, defaultBranch, onProgress);
    const supportedFiles = filterFiles(allItems);
    result.filesScanned = supportedFiles.length;

    onProgress?.({ step: "scanning", progress: 20, message: `Found ${supportedFiles.length} files to index` });

    // Step 2: Scan — fetch content and parse each file
    onProgress?.({ step: "parsing", progress: 25, message: "Parsing source files..." });
    await env.storage.saveProgress(repoId, { step: "parsing", progress: 25, message: "Parsing files" });

    const parsedFiles = [];
    const fileContents = new Map<string, string>();

    // Process files in batches of 5 to avoid rate limiting
    for (let i = 0; i < supportedFiles.length; i += 5) {
      const batch = supportedFiles.slice(i, i + 5);
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          const content = await fetchFileContent(env.githubToken, repoId, item.path);
          const parsed = parseFile(item.path, content);
          parsed.sha = item.sha;
          return { content, parsed };
        }),
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          parsedFiles.push(r.value.parsed);
          fileContents.set(r.value.parsed.path, r.value.content);
        } else {
          result.errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
        }
      }

      const progress = 25 + Math.round(((i + batch.length) / supportedFiles.length) * 15);
      onProgress?.({ step: "parsing", progress, message: `Parsed ${parsedFiles.length}/${supportedFiles.length} files` });
    }

    result.filesParsed = parsedFiles.length;

    // Step 3: Build dependency graph
    onProgress?.({ step: "graph", progress: 45, message: "Building dependency graph..." });
    await env.storage.saveProgress(repoId, { step: "graph", progress: 45, message: "Building dependency graph" });

    const graph = buildDependencyGraph(parsedFiles);

    // Step 4: Chunk files for embedding
    onProgress?.({ step: "chunking", progress: 50, message: "Generating code chunks..." });
    await env.storage.saveProgress(repoId, { step: "chunking", progress: 50, message: "Chunking code" });

    const chunks = generateChunks(parsedFiles, fileContents);
    result.chunksGenerated = chunks.length;

    // Step 5: Embed chunks
    onProgress?.({ step: "embedding", progress: 60, message: `Generating embeddings for ${chunks.length} chunks...` });
    await env.storage.saveProgress(repoId, { step: "embedding", progress: 60, message: "Embedding chunks" });

    const embeddings = await generateEmbeddings(
      env.ai as { run: (model: string, inputs: { text: string[] }) => Promise<{ data: number[][] }> },
      chunks,
      repoId,
      (done, total) => {
        const pct = 60 + Math.round((done / total) * 10);
        onProgress?.({ step: "embedding", progress: pct, message: `Embedded ${done}/${total} chunks` });
      },
    );
    result.embeddingsGenerated = embeddings.length;

    // Step 6: Store vectors
    onProgress?.({ step: "storing", progress: 72, message: "Storing vector embeddings..." });
    await env.storage.storeVectors(env.vectorIndex, repoId, embeddings);

    // Step 7: Generate docs
    onProgress?.({ step: "generating", progress: 75, message: "Generating codebase documentation..." });
    await env.storage.saveProgress(repoId, { step: "generating", progress: 75, message: "Generating docs" });

    const fileSummaries = parsedFiles.map((f) => ({
      path: f.path,
      language: f.language,
      exports: f.exports,
      functions: f.functions.map((fn) => fn.name),
      classes: f.classes.map((cls) => cls.name),
      imports: f.imports,
    }));

    const languages: Record<string, number> = {};
    for (const f of parsedFiles) {
      languages[f.language] = (languages[f.language] ?? 0) + 1;
    }

    const externalDeps = graph.edges
      .filter((e) => e.kind === "dynamic")
      .map((e) => e.target)
      .filter((t, i, a) => a.indexOf(t) === i);

    const docs = await generateCodebaseDocs(
      env.ai as { run: (model: string, inputs: { prompt: string; stream?: boolean }) => Promise<{ response?: string } | ReadableStream> },
      {
        repoId,
        defaultBranch,
        fileCount: parsedFiles.length,
        languages,
        files: fileSummaries,
        dependencySummary: { totalEdges: graph.edges.length, externalDeps },
      },
    );
    result.docsGenerated = docs.length;

    // Step 8: Store docs
    onProgress?.({ step: "storing", progress: 90, message: `Saving ${docs.length} generated docs...` });
    await env.storage.saveProgress(repoId, { step: "storing", progress: 90, message: "Storing docs" });
    await env.storage.saveDocs(docs);

    // Step 9: Mark repo as indexed
    await env.storage.markRepoIndexed(repoId);

    onProgress?.({ step: "done", progress: 100, message: "Indexing complete" });
    await env.storage.saveProgress(repoId, { step: "done", progress: 100, message: "Complete" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(errMsg);
    await env.storage.markRepoFailed(repoId, errMsg);
    onProgress?.({ step: "failed", progress: 0, message: errMsg });
  }

  await env.storage.saveResult(repoId, result);
  return result;
}
