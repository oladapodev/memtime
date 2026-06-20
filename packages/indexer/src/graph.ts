import type { ParsedFile, DependencyGraph, DependencyEdge } from "./types";

/**
 * Build a dependency graph from a set of parsed files.
 * Resolves import paths to actual file paths in the repo.
 */
export function buildDependencyGraph(files: ParsedFile[]): DependencyGraph {
  const fileMap = new Map<string, ParsedFile>();
  for (const f of files) fileMap.set(f.path, f);

  const nodes = files.map((f) => f.path);
  const edges: DependencyEdge[] = [];

  for (const file of files) {
    for (const imp of file.imports) {
      const resolved = resolveImport(imp, file.path, fileMap);
      if (resolved && resolved !== file.path) {
        edges.push({
          source: file.path,
          target: resolved,
          kind: detectImportKind(imp),
        });
      }
    }
  }

  return { nodes, edges };
}

function detectImportKind(imp: string): DependencyEdge["kind"] {
  if (imp.startsWith(".") || imp.startsWith("/")) return "import";
  return "dynamic";
}

/**
 * Resolve an import path to an actual file path in the repo.
 * E.g., "./utils" → "./utils.ts" or "./utils/index.ts"
 */
function resolveImport(
  imp: string,
  sourcePath: string,
  fileMap: Map<string, ParsedFile>,
): string | null {
  // Skip external/node_modules imports
  if (!imp.startsWith(".") && !imp.startsWith("/")) return null;

  const sourceDir = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
  const resolved = imp.startsWith(".") ? joinPath(sourceDir, imp) : imp.slice(1); // strip leading /

  // Try exact match, then with extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".py", ".rs", ".go"];
  if (fileMap.has(resolved)) return resolved;

  for (const ext of extensions) {
    if (fileMap.has(resolved + ext)) return resolved + ext;
  }

  // Try index files
  for (const ext of extensions) {
    if (fileMap.has(`${resolved}/index${ext}`)) return `${resolved}/index${ext}`;
  }

  return null;
}

function joinPath(dir: string, file: string): string {
  if (!dir) return file;
  if (file.startsWith("/")) return file.slice(1);

  const dirParts = dir.split("/");
  const fileParts = file.split("/");

  for (const part of fileParts) {
    if (part === ".") continue;
    if (part === "..") dirParts.pop();
    else dirParts.push(part);
  }

  return dirParts.join("/");
}

/**
 * Find all files that depend on a given file (transitive dependents).
 */
export function findDependents(
  graph: DependencyGraph,
  filePath: string,
  maxDepth = 3,
): string[] {
  const visited = new Set<string>();
  const dependents: string[] = [];

  function traverse(target: string, depth: number) {
    if (depth > maxDepth || visited.has(target)) return;
    visited.add(target);

    for (const edge of graph.edges) {
      if (edge.target === target && !visited.has(edge.source)) {
        dependents.push(edge.source);
        traverse(edge.source, depth + 1);
      }
    }
  }

  traverse(filePath, 0);
  return dependents;
}
