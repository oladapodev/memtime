export function repoKey(repo: string): string {
  return repo.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
}

export function prBranchName(repo: string, prNumber: number): string {
  return `pr/${repoKey(repo)}/${prNumber}`;
}
