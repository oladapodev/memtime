import React, { useEffect, useMemo, useState } from "react";
import { ThumbsUp, ThumbsDown, MinusCircle, MagnifyingGlass } from "@phosphor-icons/react";
import { Card } from "../design-system/components/Card";
import { Panel } from "../design-system/components/Panel";
import { Button } from "../design-system/components/Button";
import { Input, Textarea } from "../design-system/components/Input";
import { Badge } from "../design-system/components/Badge";
import { SeverityBadge } from "../design-system/components/Badge";
import { StatusDot } from "../design-system/components/StatusDot";
import { Empty } from "../design-system/components/Empty";
import { playSuccess, playClick } from "../design-system/sound";

type Run = { id: string; repo: string; prNumber: number; status: string; summary: string | null; createdAt: string };
type Finding = { severity: string; filePath?: string; file_path?: string; title: string; body: string; suggestion: string; memoryFact?: string; memory_fact?: string; feedbackType?: string; id?: string };
type RunDetail = Run & { findings?: Finding[]; markdown?: string };


export function Reviews() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<RunDetail | null>(null);
  const [diff, setDiff] = useState("");
  const [repo, setRepo] = useState("");
  const [pr, setPr] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/runs").then((r) => r.ok && r.json()).then(setRuns).catch(() => {});
  }, []);

  async function loadRun(id: string) {
    playClick();
    const res = await fetch(`/api/runs/${id}`);
    if (res.ok) setSelected(await res.json());
  }

  async function runLocalReview() {
    setBusy(true);
    try {
      const res = await fetch("/api/review/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, prNumber: pr, diff, title: "Manual review" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelected(data);
        playSuccess();
      }
    } finally {
      setBusy(false);
    }
  }

  const findings = selected?.findings ?? [];
  const facts = useMemo(
    () => findings.map((f) => f.memory_fact ?? f.memoryFact).filter((f): f is string => Boolean(f)),
    [findings],
  );
  const [feedbackState, setFeedbackState] = useState<Record<string, string>>({});

  async function submitFeedback(finding: Finding, feedbackType: string) {
    const ruleId = finding.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const key = `${selected?.id}-${finding.title}`;
    setFeedbackState((prev) => ({ ...prev, [key]: feedbackType }));
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId: finding.id ?? finding.title,
          runId: selected?.id ?? "",
          ruleId,
          feedbackType,
          comment: "",
        }),
      });
    } catch {
      setFeedbackState((prev) => ({ ...prev, [key]: "" }));
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h2 className="font-heading text-2xl font-bold text-zinc-50">Reviews</h2>
        <p className="text-sm text-zinc-500 mt-1">Run PR reviews and inspect findings</p>
      </header>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
        {/* Sidebar */}
        <div className="space-y-4">
          <Panel title="Manual review">
            <div className="space-y-3">
              <Input
                label="Repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo"
              />
              <Input
                label="PR number"
                type="number"
                value={pr}
                onChange={(e) => setPr(Number(e.target.value))}
              />
              <Textarea
                label="Diff"
                value={diff}
                onChange={(e) => setDiff(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <Button
                variant="brand"
                size="sm"
                className="w-full"
                onClick={runLocalReview}
                loading={busy}
                sound
              >
                {busy ? "Reviewing…" : "Run review"}
              </Button>
            </div>
          </Panel>

          {runs.length > 0 && (
            <Panel title="Recent runs">
              <div className="divide-y divide-zinc-800">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    className="w-full flex items-center gap-2.5 py-2 first:pt-0 last:pb-0 text-left hover:text-zinc-200 transition-colors"
                    onClick={() => loadRun(run.id)}
                  >
                    <StatusDot status={run.status as any} size="xs" />
                    <span className="flex-1 text-xs font-mono text-zinc-400 truncate">
                      {run.repo}#{run.prNumber}
                    </span>
                    <Badge variant={run.status as any} dot={false} size="sm">{run.status}</Badge>
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Main content */}
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-100">{selected.summary ?? "Review results"}</h3>
              {facts.length > 0 && (
                <Button variant="secondary" size="xs" sound>Promote conventions</Button>
              )}
            </div>
            <div className="space-y-3">
              {findings.length === 0 ? (
                <Card className="p-6">
                  <Empty title="No findings" message="This review produced no findings." />
                </Card>
              ) : findings.map((f, i) => {
                const feedbackKey = `${selected?.id}-${f.title}`;
                const currentFeedback = feedbackState[feedbackKey] ?? f.feedbackType ?? "";
                return (
                  <Card key={i} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={f.severity as any} size="sm" />
                      <div className="flex items-center gap-1">
                        {[
                          { type: "helpful", icon: <ThumbsUp size={13} />, title: "Helpful" },
                          { type: "false_positive", icon: <ThumbsDown size={13} />, title: "False positive" },
                          { type: "not_useful", icon: <MinusCircle size={13} />, title: "Not useful" },
                        ].map(({ type, icon, title }) => (
                          <button
                            key={type}
                            className={[
                              "p-1.5 rounded-md transition-colors",
                              currentFeedback === type
                                ? "bg-zinc-700 text-zinc-200"
                                : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800",
                            ].join(" ")}
                            title={title}
                            onClick={() => submitFeedback(f, type)}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                    <h4 className="text-sm font-medium text-zinc-200">{f.title}</h4>
                    <p className="text-sm text-zinc-500">{f.body}</p>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
                      <p className="text-xs text-zinc-600">{f.suggestion}</p>
                      {(f.filePath ?? f.file_path) && (
                        <code className="text-xs text-zinc-600 font-mono shrink-0">{f.filePath ?? f.file_path}</code>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <Card className="p-12">
            <Empty
              icon={<MagnifyingGlass size={36} weight="duotone" />}
              title="No review selected"
              message="Select a run or submit a manual review to see results."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
