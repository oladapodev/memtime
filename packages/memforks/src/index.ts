import type { MemoryAdapter, MemoryEvent } from "../../core/src/index";

type EnvLike = Record<string, string | undefined>;

type MemForkClient = {
  branch?: (name: string, options: { from: string }) => Promise<unknown>;
  recall?: (query: string, options: { branch: string; limit?: number }) => Promise<Array<string | { text?: string }>>;
  commit?: (branch: string, payload: { message: string; facts: string[] }) => Promise<{ blobId?: string; txId?: string } | unknown>;
  proposeMerge?: (payload: { fromBranch: string; intoBranch: string; resolverId: string }) => Promise<{ txId?: string } | unknown>;
};

export class DryRunMemoryAdapter implements MemoryAdapter {
  private facts = new Map<string, string[]>();

  async branch(name: string, from: string): Promise<MemoryEvent> {
    this.facts.set(name, [...(this.facts.get(from) ?? [])]);
    return { kind: "branch", branch: name, detail: `created from ${from}`, ok: true };
  }

  async recall(query: string, branch: string): Promise<string[]> {
    const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
    return (this.facts.get(branch) ?? []).filter((fact) => {
      const lower = fact.toLowerCase();
      return terms.some((term) => lower.includes(term));
    });
  }

  async commit(branch: string, message: string, facts: string[]): Promise<MemoryEvent> {
    this.facts.set(branch, [...new Set([...(this.facts.get(branch) ?? []), ...facts])]);
    return { kind: "commit", branch, detail: `${message}: ${facts.length} fact(s)`, ok: true };
  }

  async promote(from: string, into: string, facts: string[]): Promise<MemoryEvent> {
    this.facts.set(into, [...new Set([...(this.facts.get(into) ?? []), ...facts])]);
    return { kind: "promote", branch: into, detail: `promoted ${facts.length} fact(s) from ${from}`, ok: true };
  }
}

export class MemForksMemoryAdapter implements MemoryAdapter {
  constructor(
    private client: MemForkClient,
    private resolverId?: string,
  ) {}

  async branch(name: string, from: string): Promise<MemoryEvent> {
    await this.client.branch?.(name, { from });
    return { kind: "branch", branch: name, detail: `created from ${from} on MemForks`, ok: true };
  }

  async recall(query: string, branch: string): Promise<string[]> {
    const facts = (await this.client.recall?.(query, { branch, limit: 8 })) ?? [];
    return facts.map((fact) => (typeof fact === "string" ? fact : fact.text ?? "")).filter(Boolean);
  }

  async commit(branch: string, message: string, facts: string[]): Promise<MemoryEvent> {
    const result = await this.client.commit?.(branch, { message, facts });
    const ids = typeof result === "object" && result ? (result as { blobId?: string; txId?: string }) : {};
    return { kind: "commit", branch, detail: `committed ${facts.length} fact(s)`, ok: true, blobId: ids.blobId, txId: ids.txId };
  }

  async promote(from: string, into: string, facts: string[]): Promise<MemoryEvent> {
    if (this.resolverId && this.client.proposeMerge) {
      const result = await this.client.proposeMerge({ fromBranch: from, intoBranch: into, resolverId: this.resolverId });
      const ids = typeof result === "object" && result ? (result as { txId?: string }) : {};
      return { kind: "merge_proposal", branch: into, detail: `proposed governed merge from ${from}`, ok: true, txId: ids.txId };
    }

    await this.client.commit?.(into, { message: `promote reviewed memory from ${from}`, facts });
    return { kind: "promote", branch: into, detail: `promoted ${facts.length} fact(s) from ${from}`, ok: true };
  }
}

export async function createMemoryAdapter(env: EnvLike): Promise<MemoryAdapter> {
  if (env.FORKBOT_MEMFORK_ENABLED !== "true") return new DryRunMemoryAdapter();

  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as <T>(specifier: string) => Promise<T>;
    const mod = await dynamicImport<Record<string, unknown>>("@memfork/core");
    const Client = mod.MemForksClient as (new (config: unknown) => MemForkClient) | undefined;
    if (!Client) throw new Error("MemForksClient export not found");

    const client = new Client({
      treeId: env.MEMFORK_TREE_ID,
      signer: env.MEMFORK_PRIVATE_KEY,
      network: env.MEMFORK_NETWORK ?? "mainnet",
      memwal: {
        accountId: env.MEMFORK_MEMWAL_ACCOUNT,
        delegateKey: env.MEMFORK_MEMWAL_KEY,
        serverUrl: env.MEMFORK_RELAYER_URL,
      },
    });

    return new MemForksMemoryAdapter(client, env.MEMFORK_RESOLVER_ID);
  } catch (error) {
    if (env.FORKBOT_STRICT_MEMFORK === "true") throw error;
    return new DryRunMemoryAdapter();
  }
}
