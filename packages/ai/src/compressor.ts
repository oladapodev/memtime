import type { CompressedDiff, DiffChunk } from "./types";

/**
 * Compress a PR diff into token-aware chunks.
 * Strategy: Split by file, estimate tokens, group into chunks that fit context window.
 */
export function compressDiff(diff: string): CompressedDiff {
  const fileChunks = splitByFile(diff);
  const chunks: DiffChunk[] = fileChunks.map((fc) => {
    const lines = fc.content.split("\n");
    const linesAdded = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const linesRemoved = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    return {
      filePath: fc.path,
      hunks: fc.content,
      changeType: classifyChange(fc.content),
      linesAdded,
      linesRemoved,
    };
  });

  const totalTokens = estimateTokens(diff);
  const summary = generateSummary(chunks);

  return { chunks, tokenEstimate: totalTokens, summary };
}

/**
 * Split a unified diff into per-file chunks.
 */
function splitByFile(diff: string): Array<{ path: string; content: string }> {
  const filePattern = /^diff --git a\/(.+?) b\/(.+)$/gm;
  const files: Array<{ path: string; content: string }> = [];
  let lastIndex = 0;
  let lastPath = "";

  let match: RegExpExecArray | null;
  while ((match = filePattern.exec(diff)) !== null) {
    if (lastPath) {
      files.push({ path: lastPath, content: diff.slice(lastIndex, match.index).trim() });
    }
    lastPath = match[2]; // Use b/ path (new)
    lastIndex = match.index;
  }

  if (lastPath) {
    files.push({ path: lastPath, content: diff.slice(lastIndex).trim() });
  }

  return files;
}

function classifyChange(content: string): DiffChunk["changeType"] {
  if (content.includes("new file mode") || content.includes("--- /dev/null")) return "added";
  if (content.includes("deleted file mode") || content.includes("+++ /dev/null")) return "deleted";
  if (content.includes("rename from")) return "renamed";
  return "modified";
}

/**
 * Estimate token count for a text string.
 * Rough estimate: 4 characters ≈ 1 token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate a human-readable summary of the diff.
 */
function generateSummary(chunks: DiffChunk[]): string {
  const totalAdded = chunks.reduce((s, c) => s + c.linesAdded, 0);
  const totalRemoved = chunks.reduce((s, c) => s + c.linesRemoved, 0);
  const filesChanged = chunks.length;
  const addedFiles = chunks.filter((c) => c.changeType === "added").length;
  const deletedFiles = chunks.filter((c) => c.changeType === "deleted").length;

  if (filesChanged === 0) return "No changes detected.";

  const parts = [`${filesChanged} file(s) changed`];
  if (totalAdded > 0) parts.push(`+${totalAdded}`);
  if (totalRemoved > 0) parts.push(`-${totalRemoved}`);
  if (addedFiles > 0) parts.push(`(${addedFiles} added)`);
  if (deletedFiles > 0) parts.push(`(${deletedFiles} deleted)`);

  return parts.join(" ");
}

/**
 * For very large diffs, return only a prioritized subset of chunks.
 * Priority: added files > modified source files > config/deleted files.
 */
export function prioritizeChunks(chunks: DiffChunk[], maxChunks = 10): DiffChunk[] {
  const priorityOrder: DiffChunk["changeType"][] = ["added", "modified", "renamed", "deleted"];
  const sorted = [...chunks].sort((a, b) => {
    const aP = priorityOrder.indexOf(a.changeType);
    const bP = priorityOrder.indexOf(b.changeType);
    return aP - bP || b.linesAdded - a.linesAdded;
  });
  return sorted.slice(0, maxChunks);
}
