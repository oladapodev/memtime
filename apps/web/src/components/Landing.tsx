import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  GitBranch,
  Brain,
  ShieldCheck,
  Lightning,
  GitPullRequest,
  ArrowRight,
  CheckCircle,
  Terminal,
  Cpu,
  Lock,
  Sparkle,
} from "@phosphor-icons/react";
import { Logo, ForkColorLegend } from "../design-system/Logo";
import { Button } from "../design-system/components/Button";
import { Badge } from "../design-system/components/Badge";
import { playSuccess } from "../design-system";

gsap.registerPlugin(ScrollTrigger);


const HOW_IT_WORKS = [
  {
    step: "01",
    color: "#9F1239",
    icon: <GitBranch size={24} weight="duotone" />,
    title: "PR opens",
    desc: "Forkbot detects the pull request and spins up a clean, isolated memory context — no cross-PR bleed.",
  },
  {
    step: "02",
    color: "#f59e0b",
    icon: <Brain size={24} weight="duotone" />,
    title: "Codebase indexed",
    desc: "Relevant files, types, and architectural patterns are vectorised in seconds for this PR only.",
  },
  {
    step: "03",
    color: "#0ea5e9",
    icon: <ShieldCheck size={24} weight="duotone" />,
    title: "Review delivered",
    desc: "Context-aware comments land directly on GitHub. Memory wiped after merge — zero leakage.",
  },
];

const FEATURES = [
  {
    icon: <Lock size={28} weight="duotone" />,
    color: "#9F1239",
    title: "Isolated memory",
    desc: "Each PR gets its own sandboxed context. Nothing bleeds between branches.",
  },
  {
    icon: <Cpu size={28} weight="duotone" />,
    color: "#f59e0b",
    title: "Architecture aware",
    desc: "Understands your full codebase — not just the diff. Catches structural regressions.",
  },
  {
    icon: <Lightning size={28} weight="duotone" />,
    color: "#0ea5e9",
    title: "Under 60 seconds",
    desc: "Review delivered before your team even opens the PR. Zero wait for CI.",
  },
  {
    icon: <Sparkle size={28} weight="duotone" />,
    color: "#22c55e",
    title: "Learns your style",
    desc: "Picks up your team's conventions, patterns, and preferences over time.",
  },
];

const CODE_LINES = [
  { text: "→ ", color: "#fbbf24" },
  { text: "Forkbot", color: "#38bdf8" },
  { text: " scanning PR #142\n\n", color: null },
  { text: "✓", color: "#4ade80" },
  { text: " Memory context: ", color: null },
  { text: "isolated", color: "#fbbf24" },
  { text: "\n", color: null },
  { text: "✓", color: "#4ade80" },
  { text: " Codebase indexed: ", color: null },
  { text: "1,284 files", color: "#38bdf8" },
  { text: "\n", color: null },
  { text: "✓", color: "#4ade80" },
  { text: " Diff analysis: ", color: null },
  { text: "23 chunks", color: "#c084fc" },
  { text: "\n\n", color: null },
  { text: "⚠", color: "#f87171" },
  { text: " Breaking change detected in ", color: null },
  { text: "auth/session.ts", color: "#fbbf24" },
  { text: "\n  Line 47: ", color: null },
  { text: "null", color: "#f87171" },
  { text: " not handled — ", color: null },
  { text: "3 callers affected", color: "#38bdf8" },
  { text: "\n\n", color: null },
  { text: "✓", color: "#4ade80" },
  { text: " Review posted → GitHub PR #142", color: null },
];

export function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // gsap.matchMedia — respect prefers-reduced-motion (gsap-core skill rule)
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero entrance — stagger children
        gsap.from(".hero-animate", {
          autoAlpha: 0, // autoAlpha not opacity (gsap-core skill rule)
          y: 24,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.1,
          clearProps: "all",
        });

        // Logo float loop
        gsap.to(".hero-logo", {
          y: -12,
          duration: 6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });

        // Features grid — ScrollTrigger.batch (gsap-core skill rule)
        ScrollTrigger.batch(".feature-card", {
          onEnter: (batch) => {
            gsap.from(batch, {
              autoAlpha: 0,
              y: 32,
              duration: 0.5,
              ease: "power3.out",
              stagger: 0.08,
              clearProps: "all",
            });
          },
          once: true,
          start: "top 88%",
        });

        // Steps — stagger from left
        ScrollTrigger.batch(".step-card", {
          onEnter: (batch) => {
            gsap.from(batch, {
              autoAlpha: 0,
              x: -24,
              duration: 0.5,
              ease: "power3.out",
              stagger: 0.12,
              clearProps: "all",
            });
          },
          once: true,
          start: "top 85%",
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="min-h-screen bg-zinc-950 text-zinc-200 overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-40 h-14 flex items-center px-6 border-b border-zinc-800/60 backdrop-blur-xl bg-zinc-950/80">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo variant="mark" size={32} />
            <span className="font-heading font-semibold text-zinc-100 tracking-tight text-[15px]">
              Forkbot
            </span>
            <ForkColorLegend />
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#how-it-works"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block"
            >
              How it works
            </a>
            <a
              href="#features"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors hidden sm:block"
            >
              Features
            </a>              <Button
                variant="brand"
                size="sm"
                onClick={() => window.location.href = '/api/auth/github'}
                iconRight={<ArrowRight size={14} weight="bold" />}
              >
                Sign in with GitHub
              </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6">
        {/* Grid bg */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#9F1239 1px,transparent 1px),linear-gradient(90deg,#9F1239 1px,transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        {/* Radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%,rgba(159,18,57,0.12) 0%,transparent 70%)",
          }}
        />

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <div className="hero-animate">
              <Badge variant="running" dot>Now in beta</Badge>
            </div>
            <h1 className="hero-animate mt-6 font-heading text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight">
              <span className="text-gradient">Isolated memory</span>{" "}
              <br className="hidden sm:block" />
              <span className="text-zinc-50">for every PR.</span>
            </h1>
            <p className="hero-animate mt-5 text-lg text-zinc-400 max-w-xl">
              Forkbot spins up a sandboxed AI context for each pull request —
              architecture-aware reviews with zero cross-PR bleed.
            </p>
            <div className="hero-animate mt-8 flex items-center flex-wrap gap-3">
              <Button
                variant="brand"
                size="lg"
                onClick={() => window.location.href = '/api/auth/github'}
                iconRight={<ArrowRight size={16} weight="bold" />}
              >
                Sign in with GitHub
              </Button>
              <Button variant="secondary" size="lg" iconLeft={<GitPullRequest size={16} weight="duotone" />}
                onClick={() => window.open('https://github.com/apps/forkbot-dev/installations/new', '_blank')}>
                Install GitHub App
              </Button>
            </div>
            <ul className="hero-animate mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {["No setup", "GitHub App", "Free for OSS"].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-sm text-zinc-500">
                  <CheckCircle size={14} weight="fill" className="text-forkbot-green" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="hero-animate flex flex-col items-center gap-6">
            <div className="hero-logo">
              <Logo variant="full" size={200} />
            </div>
            {/* Terminal preview card */}
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-forkbot-green" />
                <span className="ml-2 text-xs text-zinc-600 font-mono">forkbot — review</span>
              </div>
              <pre className="px-4 py-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                {CODE_LINES.map((seg, i) =>
                  seg.color ? (
                    <span key={i} style={{ color: seg.color }}>{seg.text}</span>
                  ) : (
                    <React.Fragment key={i}>{seg.text}</React.Fragment>
                  )
                )}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest text-zinc-600 mb-3">Process</p>
            <h2 className="font-heading text-4xl font-bold text-zinc-50 tracking-tight">
              How it works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((s) => (
              <div
                key={s.step}
                className="step-card bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors duration-200"
              >
                <div
                  className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-5"
                  style={{ background: `${s.color}22`, color: s.color }}
                >
                  {s.icon}
                </div>
                <div className="font-mono text-xs text-zinc-600 mb-2">{s.step}</div>
                <h3 className="font-heading text-lg font-semibold text-zinc-100 mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-zinc-900/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest text-zinc-600 mb-3">Capabilities</p>
            <h2 className="font-heading text-4xl font-bold text-zinc-50 tracking-tight">
              Built for real teams
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="feature-card bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors duration-200"
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
                  style={{ background: `${f.color}18`, color: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="font-heading text-base font-semibold text-zinc-100 mb-1.5">{f.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-28 px-6 text-center relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 60% at 50% 100%,rgba(14,165,233,0.08) 0%,transparent 70%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="font-heading text-4xl lg:text-5xl font-bold text-zinc-50 tracking-tight">
            Start reviewing smarter
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Connect your repo in under a minute. No config files, no YAML.
          </p>
          <div className="mt-10 flex justify-center gap-3 flex-wrap">
            <Button
              variant="brand"
              size="lg"
              onClick={() => window.location.href = '/api/auth/github'}
              iconRight={<ArrowRight size={16} weight="bold" />}
            >
              Sign in with GitHub
            </Button>
            <Button variant="secondary" size="lg" iconLeft={<Terminal size={16} weight="duotone" />}>
              View docs
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo variant="mark" size={22} />
            <span className="text-sm text-zinc-500 font-heading">Forkbot</span>
          </div>
          <p className="text-xs text-zinc-700">
            © 2025 Forkbot. Isolated memory for every PR.
          </p>
        </div>
      </footer>
    </div>
  );
}
