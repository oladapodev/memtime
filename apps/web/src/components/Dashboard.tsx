import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChartBar,
  FolderOpen,
  GitPullRequest,
  ChatCircle,
  Book,
  Sun,
  Moon,
  User,
  SpeakerHigh,
  SpeakerX,
} from "@phosphor-icons/react";
import { Logo } from "../design-system/Logo";
import { playNavigate, setSoundEnabled, isSoundEnabled } from "../design-system/sound";
import { Overview } from "./Overview";
import { Repositories } from "./Repositories";
import { Reviews } from "./Reviews";
import { FeedbackStats } from "./FeedbackStats";
import { Codebase } from "./Codebase";

type Page = "overview" | "repos" | "reviews" | "codebase" | "feedback";

const NAV_ITEMS = [
  { id: "overview" as Page, icon: ChartBar, label: "Overview", shortcut: "1" },
  { id: "repos" as Page, icon: FolderOpen, label: "Repositories", shortcut: "2" },
  { id: "reviews" as Page, icon: GitPullRequest, label: "Reviews", shortcut: "3" },
  { id: "codebase" as Page, icon: Book, label: "Codebase", shortcut: "4" },
  { id: "feedback" as Page, icon: ChatCircle, label: "Feedback", shortcut: "5" },
];

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.14 } },
};

export function Dashboard({ user }: { user: { login: string } | null }) {
  const [page, setPage] = useState<Page>("overview");
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, Page> = {
        "1": "overview", "2": "repos", "3": "reviews", "4": "codebase", "5": "feedback",
      };
      if (e.key in map) { navigate(map[e.key]); return; }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function navigate(p: Page) {
    setPage(p);
    playNavigate();
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 overflow-hidden">

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800">

        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800">
          <Logo variant="mark" size={28} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold font-heading text-zinc-100 leading-tight">Forkbot</div>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wide">Dashboard</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(({ id, icon: Icon, label, shortcut }) => {
            const active = page === id;
            return (
              <button
                key={id}
                className={[
                  "w-full flex items-center gap-2.5 px-3.5 py-2 mx-1.5 rounded-lg text-sm transition-all duration-[120ms] ease-out",
                  active
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50",
                ].join(" ")}
                style={{ width: "calc(100% - 12px)" }}
                onClick={() => navigate(id)}
                title={`Shortcut: ${shortcut}`}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} />
                <span className="flex-1 text-left">{label}</span>
                <kbd className="text-[10px] text-zinc-700 font-mono bg-zinc-800 rounded px-1">{shortcut}</kbd>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-3 py-3 flex flex-col gap-2">
          {user && (
            <div className="flex items-center gap-2 px-1">
              <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <User size={11} weight="bold" className="text-zinc-400" />
              </span>
              <span className="text-[11px] text-zinc-500 truncate">{user.login}</span>
            </div>
          )}
          <button
            className="flex items-center gap-2 px-1 py-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors rounded"
            onClick={toggleSound}
            title="Toggle UI sounds"
          >
            {soundOn
              ? <SpeakerHigh size={13} weight="fill" />
              : <SpeakerX size={13} weight="fill" />}
            {soundOn ? "Sounds on" : "Sounds off"}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="p-6"
          >
            {page === "overview"  && <Overview />}
            {page === "repos"     && <Repositories />}
            {page === "reviews"   && <Reviews />}
            {page === "codebase"  && <Codebase />}
            {page === "feedback"  && <FeedbackStats />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
