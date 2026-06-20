import React, { useCallback, useEffect, useState } from "react";
import {
  GitBranch,
  ArrowsClockwise,
  FileText,
  Lightning,
} from "@phosphor-icons/react";
import { Card } from "../design-system/components/Card";
import { Badge } from "../design-system/components/Badge";
import { Button } from "../design-system/components/Button";
import { Select } from "../design-system/components/Input";
import { Empty } from "../design-system/components/Empty";

type RepoInfo = {
  id: string;
  full_name: string;
  default_branch: string;
  index_status: string | null;
};

type IndexProgress = {
  status: string;
  step: string | null;
  progress: number;
  error: string | null;
};

type TriggerConfig = {
  trigger_mode: string;
  config_json: string;
};

export function Repositories() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Map<string, IndexProgress>>(new Map());
  const [triggerModes, setTriggerModes] = useState<Map<string, string>>(new Map());
  const [savingTrigger, setSavingTrigger] = useState<Set<string>>(new Set());

  const fetchRepos = useCallback(async () => {
    const res = await fetch("/api/repos");
    if (res.ok) {
      const data = await res.json();
      setRepos(data);
      for (const r of data as RepoInfo[]) {
        fetchIndexStatus(r.full_name);
        fetchTriggerConfig(r.full_name);
      }
    }
    setLoading(false);
  }, []);

  async function fetchIndexStatus(repoName: string) {
    try {
      const res = await fetch(`/api/repos/${encodeURIComponent(repoName)}/index/status`);
      if (res.ok) {
        const data = await res.json() as IndexProgress;
        setProgress((prev) => { const next = new Map(prev); next.set(repoName, data); return next; });
      }
    } catch {}
  }

  useEffect(() => { fetchRepos(); }, [fetchRepos]);

  async function fetchTriggerConfig(repoName: string) {
    try {
      const res = await fetch(`/api/repos/${encodeURIComponent(repoName)}/trigger`);
      if (res.ok) {
        const data = await res.json() as TriggerConfig;
        setTriggerModes((prev) => { const next = new Map(prev); next.set(repoName, data.trigger_mode); return next; });
      }
    } catch {}
  }

  async function handleTriggerChange(repoName: string, mode: string) {
    setSavingTrigger((prev) => new Set(prev).add(repoName));
    try {
      await fetch(`/api/repos/${encodeURIComponent(repoName)}/trigger`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger_mode: mode }),
      });
      setTriggerModes((prev) => { const next = new Map(prev); next.set(repoName, mode); return next; });
    } catch {}
    setSavingTrigger((prev) => { const next = new Set(prev); next.delete(repoName); return next; });
  }

  async function handleIndex(repoName: string) {
    setIndexing((prev) => new Set(prev).add(repoName));
    setProgress((prev) => {
      const next = new Map(prev);
      next.set(repoName, { status: "running", step: "queued", progress: 0, error: null });
      return next;
    });
    try {
      await fetch(`/api/repos/${encodeURIComponent(repoName)}/index`, { method: "POST" });
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(`/api/repos/${encodeURIComponent(repoName)}/index/status`);
        if (res.ok) {
          const data = await res.json() as IndexProgress;
          setProgress((prev) => { const next = new Map(prev); next.set(repoName, data); return next; });
          if (data.status === "completed" || data.status === "failed") {
            setIndexing((prev) => { const next = new Set(prev); next.delete(repoName); return next; });
            fetchRepos();
            return;
          }
        }
      }
    } catch {}
    setIndexing((prev) => { const next = new Set(prev); next.delete(repoName); return next; });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h2 className="font-heading text-2xl font-bold text-zinc-50">Repositories</h2>
        <p className="text-sm text-zinc-500 mt-1">Manage indexed repositories and trigger settings</p>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <Card className="p-8">
          <Empty
            icon={<GitBranch size={40} weight="duotone" />}
            title="No repositories connected"
            message="Install Forkbot on a GitHub repo to get started."
            action={
              <Button variant="brand" size="sm" sound
                onClick={() => window.open('https://github.com/apps/forkbot-dev/installations/new', '_blank')}>
                Install Forkbot
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {repos.map((repo) => {
            const prog = progress.get(repo.full_name);
            const isIndexing = indexing.has(repo.full_name);
            const status = prog?.status ?? repo.index_status ?? "pending";
            const stepLabel = prog?.step ? prog.step.replace("_", " ") : "";
            const triggerMode = triggerModes.get(repo.full_name) ?? "auto";
            const isSaving = savingTrigger.has(repo.full_name);

            return (
              <Card key={repo.id} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <GitBranch size={16} weight="duotone" className="text-forkbot-crimson shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-200 font-mono truncate">{repo.full_name}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">branch: {repo.default_branch}</div>
                  </div>
                  <Badge
                    variant={status === "indexed" ? "completed" : status as any}
                    dot
                    size="sm"
                  >
                    {status === "running" && stepLabel ? `${stepLabel}…` : status}
                  </Badge>
                </div>

                {status === "running" && prog && (
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-forkbot-sky rounded-full transition-all duration-500"
                      style={{ width: `${prog.progress}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="xs"
                    iconLeft={<ArrowsClockwise size={12} weight={isIndexing ? "regular" : "bold"} />}
                    onClick={() => handleIndex(repo.full_name)}
                    disabled={isIndexing}
                    loading={isIndexing}
                    sound
                  >
                    {isIndexing ? "Indexing…" : status === "indexed" ? "Re-index" : "Index"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    iconLeft={<FileText size={12} weight="regular" />}
                    sound={false}
                  >
                    View docs
                  </Button>

                  <div className="flex items-center gap-2 ml-auto">
                    <Lightning size={12} weight="fill" className="text-forkbot-amber" />
                    <Select
                      value={triggerMode}
                      onChange={(e) => handleTriggerChange(repo.full_name, e.target.value)}
                      disabled={isSaving}
                      className="h-6 text-xs px-2 py-0"
                    >
                      <option value="auto">Auto</option>
                      <option value="comment">Comment tag only</option>
                      <option value="custom">Custom</option>
                    </Select>
                    {isSaving && <span className="text-xs text-zinc-600">saving…</span>}
                  </div>
                </div>

                {triggerMode === "auto" && (
                  <p className="text-xs text-zinc-600">Reviews every PR on open + commit</p>
                )}
                {triggerMode === "comment" && (
                  <p className="text-xs text-zinc-600">Only reviews on /forkbot review</p>
                )}
                {triggerMode === "custom" && (
                  <p className="text-xs text-zinc-600">Custom filters — configure via API</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
