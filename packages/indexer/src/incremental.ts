import type { ParsedFile } from "./types";

/**
 * Handles incremental re-indexing when files change (on push).
 * Compares current file SHAs with previous index state.
 */

export type ChangedFiles = {
  added: string[];
  modified: string[];
  deleted: string[];
};

/**
 * Determine which files changed based on push event data.
 */
export function detectChangedFiles(
  beforeSha: string | null,
  afterSha: string | null,
  commits: Array<{
    added?: string[];
    removed?: string[];
    modified?: string[];
  }>,
): ChangedFiles {
  const added = new Set<string>();
  const modified = new Set<string>();
  const deleted = new Set<string>();

  for (const commit of commits) {
    for (const file of commit.added ?? []) added.add(file);
    for (const file of commit.removed ?? []) deleted.add(file);
    for (const file of commit.modified ?? []) modified.add(file);
  }

  return {
    added: [...added],
    modified: [...modified],
    deleted: [...deleted],
  };
}

/**
 * Given previously parsed files and changed files,
 * return the list of files that need re-parsing.
 * Only re-indexes: added files, modified files, and files that import changed files.
 */
export function computeReindexList(
  previousFiles: ParsedFile[],
  changed: ChangedFiles,
): string[] {
  const needsReindex = new Set([
    ...changed.added,
    ...changed.modified,
    // Files that import deleted files need updating
    ...findImportersOf(previousFiles, changed.deleted),
  ]);

  return [...needsReindex];
}

function findImportersOf(files: ParsedFile[], targets: string[]): string[] {
  const targetSet = new Set(targets);
  return files
    .filter((f) => f.imports.some((imp) => targetSet.has(resolveImportPath(imp, f.path))))
    .map((f) => f.path);
}

function resolveImportPath(imp: string, sourcePath: string): string {
  if (!imp.startsWith(".")) return imp;
  const dir = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
  const parts = dir ? dir.split("/") : [];
  for (const seg of imp.split("/")) {
    if (seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
