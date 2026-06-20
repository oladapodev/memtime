/** A single parsed file from the repo */
export type ParsedFile = {
  path: string;
  language: string;
  size: number;
  sha: string;
  imports: string[];
  exports: string[];
  functions: { name: string; line: number }[];
  classes: { name: string; line: number }[];
};

/** Edge in the dependency graph */
export type DependencyEdge = {
  source: string; // file path
  target: string; // file path
  kind: "import" | "require" | "dynamic";
};

/** Dependency graph for a repo */
export type DependencyGraph = {
  nodes: string[]; // file paths
  edges: DependencyEdge[];
};

/** A chunk of code ready for embedding */
export type CodeChunk = {
  id: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  content: string;
  context: "file" | "function" | "class" | "export" | "block";
  contextName?: string;
};

/** Generated documentation for a repo */
export type CodebaseDoc = {
  repoId: string;
  docType: "ARCHITECTURE" | "FILES" | "CONVENTIONS" | "DOMAIN" | "API" | "DB_SCHEMA" | "DEPLOYMENT" | "GLOSSARY";
  content: string;
  version: number;
};

/** Result of a full indexing run */
export type IndexResult = {
  repoId: string;
  repoUrl: string;
  defaultBranch: string;
  filesScanned: number;
  filesParsed: number;
  chunksGenerated: number;
  embeddingsGenerated: number;
  docsGenerated: number;
  errors: string[];
};

/** Progress update for an index job */
export type IndexProgress = {
  step: "cloning" | "scanning" | "parsing" | "graph" | "chunking" | "embedding" | "generating" | "storing" | "done" | "failed";
  progress: number; // 0-100
  message: string;
};

/** Result from embedding a batch of code chunks */
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
