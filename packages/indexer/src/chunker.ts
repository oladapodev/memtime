import type { ParsedFile, CodeChunk } from "./types";

/**
 * Split source files into semantic chunks for embedding.
 * Each chunk is a function, class, export, or top-level block.
 */
export function generateChunks(files: ParsedFile[], contents: Map<string, string>): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  for (const file of files) {
    const content = contents.get(file.path);
    if (!content) continue;

    const lines = content.split("\n");
    const charPositions = buildLinePositions(content);

    // If the file is small, chunk it as a whole
    if (lines.length < 20) {
      chunks.push({
        id: hashPath(file.path),
        filePath: file.path,
        language: file.language,
        startLine: 1,
        endLine: lines.length,
        content: content,
        context: "file",
      });
      continue;
    }

    // Create function/class chunks
    const boundaries: { line: number; name: string; type: "function" | "class" | "export" }[] = [];

    for (const fn of file.functions) {
      boundaries.push({ line: fn.line, name: fn.name, type: "function" });
    }
    for (const cls of file.classes) {
      boundaries.push({ line: cls.line, name: cls.name, type: "class" });
    }

    boundaries.sort((a, b) => a.line - b.line);

    if (boundaries.length === 0) {
      // No functions/classes — chunk by 50-line blocks
      for (let start = 1; start <= lines.length; start += 50) {
        const end = Math.min(start + 49, lines.length);
        chunks.push({
          id: `${hashPath(file.path)}_L${start}`,
          filePath: file.path,
          language: file.language,
          startLine: start,
          endLine: end,
          content: lines.slice(start - 1, end).join("\n"),
          context: "block",
        });
      }
    } else {
      // Add exports as a header chunk
      if (file.exports.length > 0) {
        chunks.push({
          id: `${hashPath(file.path)}_exports`,
          filePath: file.path,
          language: file.language,
          startLine: 1,
          endLine: boundaries[0]?.line ?? lines.length,
          content: `// Exports from ${file.path}\n// ${file.exports.join(", ")}`,
          context: "export",
          contextName: file.path,
        });
      }

      // Chunk each function/class
      for (let i = 0; i < boundaries.length; i++) {
        const b = boundaries[i];
        const nextLine = boundaries[i + 1]?.line ?? lines.length + 1;
        const chunkContent = lines.slice(b.line - 1, nextLine - 1).join("\n");

        chunks.push({
          id: `${hashPath(file.path)}_${b.type}_${b.name}`,
          filePath: file.path,
          language: file.language,
          startLine: b.line,
          endLine: nextLine - 1,
          content: chunkContent,
          context: b.type,
          contextName: b.name,
        });
      }
    }
  }

  return chunks;
}

function buildLinePositions(content: string): number[] {
  const positions: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") positions.push(i + 1);
  }
  return positions;
}

function hashPath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
