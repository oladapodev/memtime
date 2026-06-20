import React, { useState } from "react";
import { Check, GitBranch, SlidersHorizontal, Rocket } from "@phosphor-icons/react";
import { Button } from "../design-system/components/Button";
import { Logo } from "../design-system/Logo";
import { playSuccess, playClick } from "../design-system/sound";

type Repo = { full_name: string; status: "needs_index" | "indexing" | "indexed" | "failed" };
type Step = "connect" | "index" | "configure" | "done";

const STEP_DEFS = [
  { id: "connect" as Step, label: "Connect repos" },
  { id: "index" as Step, label: "Index codebase" },
  { id: "configure" as Step, label: "Configure triggers" },
  { id: "done" as Step, label: "Done" },
];

const INDEX_MILESTONES: [number, string][] = [
  [20, "Scanning files"],
  [40, "Parsing exports"],
  [60, "Building dependency graph"],
  [80, "Generating docs"],
  [100, "Storing to memory"],
];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("connect");
  const [repos] = useState<Repo[]>([{ full_name: "demo/forkbot", status: "needs_index" }]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set(["demo/forkbot"]));
  const [indexProgress, setIndexProgress] = useState(0);
  const [triggerMode, setTriggerMode] = useState<"auto" | "comment">("auto");

  function toggleRepo(name: string) {
    playClick();
    const next = new Set(selectedRepos);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSelectedRepos(next);
  }

  async function handleStartIndex() {
    setStep("index");
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setIndexProgress(i);
    }
    setStep("configure");
  }

  const stepIndex = STEP_DEFS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-2.5 justify-center mb-10">
          <Logo variant="mark" size={30} />
          <span className="font-heading font-semibold text-zinc-100 text-lg">Forkbot</span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 mb-8">
          {STEP_DEFS.map((s, i) => {
            const done = i < stepIndex;
            const active = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={[
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      done    ? "bg-forkbot-green text-zinc-950" :
                      active  ? "bg-forkbot-sky text-zinc-950" :
                                "bg-zinc-800 text-zinc-600",
                    ].join(" ")}
                  >
                    {done ? <Check size={11} weight="bold" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${active ? "text-zinc-200" : done ? "text-zinc-500" : "text-zinc-700"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEP_DEFS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${done ? "bg-forkbot-green/40" : "bg-zinc-800"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step body */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">

          {step === "connect" && (
            <>
              <div>
                <h2 className="font-heading text-xl font-semibold text-zinc-50">Select repositories</h2>
                <p className="text-sm text-zinc-500 mt-1">Forkbot will scan and build a deep understanding of each repo's architecture.</p>
              </div>
              <div className="space-y-2">
                {repos.map((repo) => (
                  <label
                    key={repo.full_name}
                    className={[
                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                      selectedRepos.has(repo.full_name)
                        ? "border-forkbot-sky/60 bg-sky-950/20"
                        : "border-zinc-800 hover:border-zinc-700",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRepos.has(repo.full_name)}
                      onChange={() => toggleRepo(repo.full_name)}
                      className="accent-forkbot-sky"
                    />
                    <GitBranch size={15} weight="duotone" className="text-forkbot-crimson shrink-0" />
                    <span className="flex-1 text-sm font-medium text-zinc-200 font-mono">{repo.full_name}</span>
                    <span className="text-xs text-zinc-600">{repo.status.replace("_", " ")}</span>
                  </label>
                ))}
              </div>
              <Button
                variant="brand"
                size="md"
                className="w-full"
                onClick={handleStartIndex}
                disabled={selectedRepos.size === 0}
                sound
              >
                Start indexing
              </Button>
            </>
          )}

          {step === "index" && (
            <div className="text-center space-y-5 py-4">
              <h2 className="font-heading text-xl font-semibold text-zinc-50">Indexing codebase</h2>
              <p className="text-sm text-zinc-500">Forkbot is analyzing your files and generating architecture documents.</p>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-forkbot-sky rounded-full transition-all duration-300"
                  style={{ width: `${indexProgress}%` }}
                />
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {INDEX_MILESTONES.map(([threshold, label]) => (
                  <span
                    key={label}
                    className={`flex items-center gap-1 text-xs transition-colors ${indexProgress >= threshold ? "text-forkbot-green" : "text-zinc-700"}`}
                  >
                    {indexProgress >= threshold && <Check size={11} weight="bold" />}
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {step === "configure" && (
            <>
              <div>
                <h2 className="font-heading text-xl font-semibold text-zinc-50">Configure triggers</h2>
                <p className="text-sm text-zinc-500 mt-1">Choose when Forkbot should review PRs on these repos.</p>
              </div>
              <div className="space-y-2">
                {[
                  { val: "auto" as const, title: "Automatic", desc: "Review every PR on open and each new commit" },
                  { val: "comment" as const, title: "Comment tag only", desc: "Only review when someone comments /forkbot review" },
                ].map(({ val, title, desc }) => (
                  <label
                    key={val}
                    className={[
                      "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                      triggerMode === val
                        ? "border-forkbot-sky/60 bg-sky-950/20"
                        : "border-zinc-800 hover:border-zinc-700",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="trigger"
                      value={val}
                      checked={triggerMode === val}
                      onChange={() => { playClick(); setTriggerMode(val); }}
                      className="mt-0.5 accent-forkbot-sky"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <Button
                variant="brand"
                size="md"
                className="w-full"
                iconLeft={<SlidersHorizontal size={15} weight="bold" />}
                onClick={() => { playSuccess(); setStep("done"); }}
                sound={false}
              >
                Save & continue
              </Button>
            </>
          )}

          {step === "done" && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-forkbot-green/15 flex items-center justify-center mx-auto">
                <Rocket size={32} weight="duotone" className="text-forkbot-green" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-semibold text-zinc-50">All set!</h2>
                <p className="text-sm text-zinc-500 mt-1">Forkbot is now monitoring your repos. Open a PR to see it in action.</p>
              </div>
              <Button
                variant="brand"
                size="lg"
                className="w-full"
                onClick={() => { playSuccess(); onComplete(); }}
                sound={false}
              >
                Go to dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
