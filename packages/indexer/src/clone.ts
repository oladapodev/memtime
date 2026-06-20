import type { ParsedFile, IndexProgress } from "./types";

/**
 * Fetches repo file tree via GitHub API.
 * No actual git clone — uses the Trees API which is Worker-friendly.
 */
export async function fetchRepoTree(
  githubToken: () => Promise<string>,
  repoFullName: string,
  branch: string,
  onProgress?: (p: IndexProgress) => void,
): Promise<GitTreeItem[]> {
  onProgress?.({ step: "scanning", progress: 10, message: `Fetching tree for ${repoFullName}@${branch}` });

  // Get the default branch's latest commit tree SHA
  const refRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/ref/heads/${branch}`,
    { headers: { Authorization: `Bearer ${await githubToken()}`, Accept: "application/vnd.github+json" } },
  );
  if (!refRes.ok) throw new Error(`Failed to get ref: ${refRes.status} ${await refRes.text()}`);
  const ref = await refRes.json() as { object: { sha: string } };

  // Get the commit to find the tree SHA
  const commitRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/git/commits/${ref.object.sha}`,
    { headers: { Authorization: `Bearer ${await githubToken()}`, Accept: "application/vnd.github+json" } },
  );
  if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.status}`);
  const commit = await commitRes.json() as { tree: { sha: string } };

  // Recursively fetch the tree
  const items = await fetchAllTreeItems(githubToken, repoFullName, commit.tree.sha, onProgress);
  onProgress?.({ step: "scanning", progress: 30, message: `Found ${items.length} files` });
  return items;
}

type GitTreeItem = {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size: number;
};

async function fetchAllTreeItems(
  githubToken: () => Promise<string>,
  repoFullName: string,
  treeSha: string,
  onProgress?: (p: IndexProgress) => void,
): Promise<GitTreeItem[]> {
  const allItems: GitTreeItem[] = [];
  const queue = [treeSha];

  while (queue.length > 0) {
    const sha = queue.pop()!;
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees/${sha}`,
      { headers: { Authorization: `Bearer ${await githubToken()}`, Accept: "application/vnd.github+json" } },
    );
    if (!res.ok) throw new Error(`Failed to get tree ${sha}: ${res.status}`);
    const tree = await res.json() as { tree: GitTreeItem[]; truncated?: boolean };

    for (const item of tree.tree) {
      if (item.type === "tree") {
        queue.push(item.sha);
      } else if (item.type === "blob") {
        // Fetch blob metadata for each file to get size
        allItems.push(item);
      }
    }

    if (tree.truncated) {
      throw new Error("Tree too large — GitHub API truncated results. Consider a subset of paths.");
    }
  }

  return allItems;
}

/**
 * Fetch a single file's content from GitHub.
 */
export async function fetchFileContent(
  githubToken: () => Promise<string>,
  repoFullName: string,
  filePath: string,
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/contents/${filePath}`,
    { headers: { Authorization: `Bearer ${await githubToken()}`, Accept: "application/vnd.github.raw" } },
  );
  if (!res.ok) throw new Error(`Failed to get file ${filePath}: ${res.status}`);
  return res.text();
}

/**
 * Get languages used in a repo (for determining parse strategies).
 */
export async function fetchRepoLanguages(
  githubToken: () => Promise<string>,
  repoFullName: string,
): Promise<Record<string, number>> {
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/languages`,
    { headers: { Authorization: `Bearer ${await githubToken()}`, Accept: "application/vnd.github+json" } },
  );
  if (!res.ok) return {};
  return res.json() as Promise<Record<string, number>>;
}

/** File extensions we care about parsing */
const SUPPORTED_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".rb",
  ".css", ".scss", ".less",
  ".json", ".yaml", ".yml", ".toml",
  ".md", ".sql",
]);

/** Directories to skip */
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out",
  ".next", ".cache", "coverage", ".wrangler",
  ".terraform", ".venv", "venv", "__pycache__",
  "target", "vendor", ".bun-install",
]);

/** Simple .gitignore pattern matching (just skips known dirs) */
export function isIgnored(path: string): boolean {
  const parts = path.split("/");
  return parts.some((part) => SKIP_DIRS.has(part));
}

export function isSupported(path: string): boolean {
  return SUPPORTED_EXTS.has(path.slice(path.lastIndexOf(".")));
}

/** Filter tree items to supported, non-ignored files */
export function filterFiles(items: GitTreeItem[]): GitTreeItem[] {
  return items.filter((item) => !isIgnored(item.path) && isSupported(item.path));
}
