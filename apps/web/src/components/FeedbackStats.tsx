import React, { useEffect, useState } from "react";
import {
  ChatCircle,
  ThumbsDown,
  ChartBar,
  Stethoscope,
  ThumbsUp,
  MinusCircle,
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import { Card } from "../design-system/components/Card";
import { Panel } from "../design-system/components/Panel";
import { SeverityBadge } from "../design-system/components/Badge";
import { Empty } from "../design-system/components/Empty";

type RuleHealth = {
  rule_id: string;
  total_findings: number;
  false_positive_count: number;
  helpful_count: number;
  false_positive_rate: number;
  current_severity: string;
  auto_suppressed: number;
  last_evaluated: string | null;
  updated_at: string;
};

type FeedbackEntry = {
  id: string;
  finding_id: string;
  rule_id: string;
  feedback_type: string;
  title: string;
  severity: string;
  file_path: string;
  created_at: string;
};

type FeedbackStatsData = {
  totalFeedback: number;
  totalFalsePositives: number;
  recentFeedback: FeedbackEntry[];
  health: RuleHealth[];
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function FeedbackIcon({ type }: { type: string }) {
  if (type === "helpful")
    return <ThumbsUp size={14} weight="fill" className="text-forkbot-green" />;
  if (type === "false_positive")
    return <ThumbsDown size={14} weight="fill" className="text-red-400" />;
  return <MinusCircle size={14} weight="fill" className="text-zinc-500" />;
}

function fpColor(rate: number): string {
  return rate >= 0.6 ? "#f87171" : rate >= 0.3 ? "#f59e0b" : "#22c55e";
}

function StatCard({ icon, value, label, accent }: { icon: React.ReactNode; value: number | string; label: string; accent?: string }) {
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

export function FeedbackStats() {
  const [data, setData] = useState<FeedbackStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>("false_positive_rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/feedback/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load feedback stats");
        return res.json();
      })
      .then((json: FeedbackStatsData) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ArrowsDownUp size={10} className="ml-1 opacity-30" />;
    return sortDir === "desc"
      ? <ArrowDown size={10} className="ml-1 text-forkbot-sky" />
      : <ArrowUp size={10} className="ml-1 text-forkbot-sky" />;
  }

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <header>
          <h2 className="font-heading text-2xl font-bold text-zinc-50">Feedback Stats</h2>
          <p className="text-sm text-zinc-500 mt-1">Loading rule health data…</p>
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl space-y-6">
        <header>
          <h2 className="font-heading text-2xl font-bold text-zinc-50">Feedback Stats</h2>
        </header>
        <Card className="p-5 border-red-800/50">
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-zinc-600 mt-2">Make sure the API server is running and feedback data has been collected.</p>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl space-y-6">
        <header>
          <h2 className="font-heading text-2xl font-bold text-zinc-50">Feedback Stats</h2>
        </header>
        <Card className="p-8">
          <Empty title="No feedback data" message="No feedback data available yet." />
        </Card>
      </div>
    );
  }

  const fpRate = data.totalFeedback > 0 ? data.totalFalsePositives / data.totalFeedback : 0;
  const sortedHealth = [...(data.health ?? [])].sort((a, b) => {
    const aVal = a[sortCol as keyof RuleHealth] ?? 0;
    const bVal = b[sortCol as keyof RuleHealth] ?? 0;
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    }
    return sortDir === "desc"
      ? String(bVal).localeCompare(String(aVal))
      : String(aVal).localeCompare(String(bVal));
  });

  const thClass = "text-left text-xs text-zinc-500 font-medium uppercase tracking-wide px-3 py-2 cursor-pointer hover:text-zinc-300 whitespace-nowrap select-none";
  const tdClass = "px-3 py-2.5 text-sm text-zinc-300";

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h2 className="font-heading text-2xl font-bold text-zinc-50">Feedback Stats</h2>
        <p className="text-sm text-zinc-500 mt-1">Rule health, false positive rates, and self-healing status</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ChatCircle size={20} weight="duotone" />} value={data.totalFeedback} label="Total feedback" />
        <StatCard icon={<ThumbsDown size={20} weight="duotone" />} value={data.totalFalsePositives} label="False positives" accent="#f87171" />
        <StatCard icon={<ChartBar size={20} weight="duotone" />} value={`${(fpRate * 100).toFixed(1)}%`} label="FP rate" accent="#f59e0b" />
        <StatCard icon={<Stethoscope size={20} weight="duotone" />} value={data.health?.length ?? 0} label="Rules tracked" accent="#0ea5e9" />
      </div>

      <Panel title="Rule Health" subtitle="Sortable — click any column header">
        {(data.health?.length ?? 0) === 0 ? (
          <Empty title="No rules tracked" message="Submit feedback on review findings to track rule health here." />
        ) : (
          <div className="overflow-x-auto -mx-4 -mb-3">
            <table className="w-full border-collapse min-w-[640px]">
              <thead className="border-b border-zinc-800">
                <tr>
                  <th className={thClass} onClick={() => toggleSort("rule_id")}>
                    <span className="flex items-center">Rule<SortIcon col="rule_id" /></span>
                  </th>
                  <th className={thClass} onClick={() => toggleSort("current_severity")}>
                    <span className="flex items-center">Severity<SortIcon col="current_severity" /></span>
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => toggleSort("total_findings")}>
                    <span className="flex items-center justify-end">Findings<SortIcon col="total_findings" /></span>
                  </th>
                  <th className={thClass} onClick={() => toggleSort("false_positive_rate")}>
                    <span className="flex items-center">FP Rate<SortIcon col="false_positive_rate" /></span>
                  </th>
                  <th className={`${thClass} text-right`} onClick={() => toggleSort("helpful_count")}>
                    <span className="flex items-center justify-end">Helpful<SortIcon col="helpful_count" /></span>
                  </th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {sortedHealth.map((rule) => {
                  const fpPct = (rule.false_positive_rate * 100).toFixed(1);
                  const isSuppressed = rule.auto_suppressed === 1;
                  return (
                    <tr key={rule.rule_id} className={isSuppressed ? "opacity-50" : "hover:bg-zinc-800/30"}>
                      <td className={tdClass}>
                        <code className="text-xs text-zinc-400 font-mono">{rule.rule_id}</code>
                      </td>
                      <td className={tdClass}>
                        <SeverityBadge severity={rule.current_severity as any} size="sm" />
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{rule.total_findings}</td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-medium tabular-nums w-10 text-right"
                            style={{ color: fpColor(rule.false_positive_rate) }}
                          >
                            {fpPct}%
                          </span>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(rule.false_positive_rate * 100, 100)}%`,
                                background: fpColor(rule.false_positive_rate),
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{rule.helpful_count}</td>
                      <td className={tdClass}>
                        {isSuppressed ? (
                          <span className="text-xs text-zinc-600 bg-zinc-800 rounded px-2 py-0.5">Suppressed</span>
                        ) : rule.false_positive_rate >= 0.3 ? (
                          <span className="text-xs text-forkbot-amber bg-amber-950/40 rounded px-2 py-0.5">Watch</span>
                        ) : (
                          <span className="text-xs text-forkbot-green bg-green-950/40 rounded px-2 py-0.5">Healthy</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Recent Feedback">
        {(data.recentFeedback?.length ?? 0) === 0 ? (
          <Empty title="No feedback yet" message="Go to the Reviews page to submit feedback on findings." />
        ) : (
          <div className="divide-y divide-zinc-800">
            {data.recentFeedback.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="mt-0.5 shrink-0">
                  <FeedbackIcon type={entry.feedback_type} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs text-zinc-500 font-mono">{entry.rule_id}</code>
                    <SeverityBadge severity={entry.severity as any} size="sm" />
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
                      {entry.feedback_type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 truncate">{entry.title}</p>
                  <div className="flex items-center gap-3">
                    {entry.file_path && (
                      <code className="text-xs text-zinc-600 font-mono truncate">{entry.file_path}</code>
                    )}
                    <span className="text-xs text-zinc-600 shrink-0">{formatDate(entry.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
