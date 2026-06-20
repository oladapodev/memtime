import React, { useEffect, useState } from "react";
import {
  FolderOpen,
  MagnifyingGlass,
  Warning,
  CheckCircle,
  Plus,
  Book,
} from "@phosphor-icons/react";
import { Card } from "../design-system/components/Card";
import { Badge } from "../design-system/components/Badge";
import { Button } from "../design-system/components/Button";
import { StatusDot } from "../design-system/components/StatusDot";
import { Empty } from "../design-system/components/Empty";
import { Panel } from "../design-system/components/Panel";

type Run = {
  id: string;
  repo: string;
  prNumber: number;
  status: string;
  summary: string | null;
  createdAt: string;
};

function StatCard({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  accent?: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={accent ? { background: `${accent}18`, color: accent } : { background: "#27272a", color: "#71717a" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-heading font-bold text-zinc-50 tabular-nums">{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

export function Overview() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { setRuns(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalFindings = runs.reduce((acc, r) => {
    if (r.summary) {
      const match = r.summary.match(/(\d+)/);
      if (match) return acc + parseInt(match[1], 10);
    }
    return acc;
  }, 0);
  const activeRepos = new Set(runs.map((r) => r.repo)).size;

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h2 className="font-heading text-2xl font-bold text-zinc-50">Overview</h2>
        <p className="text-sm text-zinc-500 mt-1">Your Forkbot activity at a glance</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<FolderOpen size={20} weight="duotone" />} value={activeRepos} label="Repos indexed" />
          <StatCard icon={<MagnifyingGlass size={20} weight="duotone" />} value={runs.length} label="PRs reviewed" />
          <StatCard icon={<Warning size={20} weight="duotone" />} value={totalFindings} label="Findings found" accent="#f59e0b" />
          <StatCard
            icon={<CheckCircle size={20} weight="duotone" />}
            value={runs.filter((r) => r.status === "completed").length}
            label="Reviews completed"
            accent="#22c55e"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Panel title="Recent reviews" subtitle="Latest PR review activity">
            {runs.length === 0 ? (
              <Empty
                icon={<MagnifyingGlass size={36} weight="duotone" />}
                title="No reviews yet"
                message="Install Forkbot on a repo and open a PR to get started."
              />
            ) : (
              <div className="divide-y divide-zinc-800">
                {runs.slice(0, 10).map((run) => (
                  <div key={run.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <StatusDot status={run.status as any} size="sm" />
                    <span className="flex-1 text-sm text-zinc-300 font-mono truncate">
                      {run.repo}
                      <span className="text-zinc-600">#{run.prNumber}</span>
                    </span>
                    <Badge variant={run.status as any} dot={false} size="sm">{run.status}</Badge>
                    <span className="text-xs text-zinc-600 tabular-nums shrink-0">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Quick actions">
          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="sm" iconLeft={<Plus size={14} weight="bold" />} className="w-full justify-start" sound
              onClick={() => window.open('https://github.com/apps/forkbot-dev/installations/new', '_blank')}>
              Add repository
            </Button>
            <Button variant="secondary" size="sm" iconLeft={<Book size={14} weight="duotone" />} className="w-full justify-start" sound>
              View documentation
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
