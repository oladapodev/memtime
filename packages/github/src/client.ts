import { createGitHubAppJwt } from "./crypto";

type GitHubClientOptions = {
  appId: string;
  privateKey: string;
  installationId: number;
};

export type PullRequestPayload = {
  number: number;
  title: string;
  headSha: string;
  baseSha: string;
  diff: string;
};

export class GitHubAppClient {
  private token?: { value: string; expiresAt: number };

  constructor(private options: GitHubClientOptions) {}

  async getInstallationToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const jwt = await createGitHubAppJwt(this.options.appId, this.options.privateKey);
    const response = await fetch(`https://api.github.com/app/installations/${this.options.installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "forkbot",
      },
    });
    if (!response.ok) throw new Error(`installation token failed: ${response.status} ${await response.text()}`);
    const json = (await response.json()) as { token: string; expires_at: string };
    this.token = { value: json.token, expiresAt: Date.parse(json.expires_at) };
    return json.token;
  }

  async fetchPrDiff(repo: string, prNumber: number): Promise<PullRequestPayload> {
    const token = await this.getInstallationToken();
    const pr = await this.github<{ title: string; head: { sha: string }; base: { sha: string } }>(
      repo,
      `/pulls/${prNumber}`,
      token,
    );
    const diffResponse = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3.diff",
        "User-Agent": "forkbot",
      },
    });
    if (!diffResponse.ok) throw new Error(`diff fetch failed: ${diffResponse.status} ${await diffResponse.text()}`);
    return {
      number: prNumber,
      title: pr.title,
      headSha: pr.head.sha,
      baseSha: pr.base.sha,
      diff: await diffResponse.text(),
    };
  }

  async postComment(repo: string, prNumber: number, body: string): Promise<void> {
    const token = await this.getInstallationToken();
    await this.github(repo, `/issues/${prNumber}/comments`, token, "POST", { body });
  }

  async createCheckRun(repo: string, headSha: string, params: { title: string; summary: string; conclusion: "success" | "neutral" | "failure" }): Promise<void> {
    const token = await this.getInstallationToken();
    await this.github(repo, "/check-runs", token, "POST", {
      name: "ForkBot PR Memory Review",
      head_sha: headSha,
      status: "completed",
      conclusion: params.conclusion,
      output: {
        title: params.title,
        summary: params.summary,
      },
    });
  }

  private async github<T = unknown>(repo: string, path: string, token: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "forkbot",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} failed: ${response.status} ${await response.text()}`);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
