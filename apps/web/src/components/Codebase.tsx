import React, { useCallback, useEffect, useState } from "react";
import {
  GitBranch,
  ArrowsClockwise,
  Book,
  FileCode,
  CheckCircle,
  Warning,
  XCircle,
  FileText,
  Stack,
  SealCheck,
  Cube,
} from "@phosphor-icons/react";
import { Card } from "../design-system/components/Card";
import { Badge } from "../design-system/components/Badge";
import { Button } from "../design-system/components/Button";
import { Panel } from "../design-system/components/Panel";
import { Empty } from "../design-system/components/Empty";
import { playClick } from "../design-system/sound";

type RepoInfo = {
  id: string;
  full_name: string;
  default_branch: string;
  index_status: string | null;
};

type IndexStatus = {
  status: string;
  step: string | null;
  progress: number;
  error: string | null;
};

type CodebaseDoc = {
  doc_type: string;
  content: string;
  version: number;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE: "Architecture",
  FILES: "File Map",
  CONVENTIONS: "Conventions",
  DOMAIN: "Domain Model",
  API: "API Reference",
  DB_SCHEMA: "DB Schema",
  DEPLOYMENT: "Deployment",
  GLOSSARY: "Glossary",
};

const DOC_TYPE_ICONS: Record<string, React.ReactNode> = {
  ARCHITECTURE: <Cube size={14} weight="duotone" />,
  FILES: <FileCode size={14} weight="duotone" />,
  CONVENTIONS: <SealCheck size={14} weight="duotone" />,
  DOMAIN: <Stack size={14} weight="duotone" />,
  API: <FileText size={14} weight="duotone" />,
  DB_SCHEMA: <Book size={14} weight="duotone" />,
  DEPLOYMENT: <ArrowsClockwise size={14} weight="duotone" />,
  GLOSSARY: <Book size={14} weight="duotone" />,
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "indexed":
    case "completed":
      return <CheckCircle size={14} weight="fill" className="text-forkbot-green" />;
    case "running":
      return <ArrowsClockwise size={14} weight="bold" className="text-forkbot-sky animate-spin" />;
    case "failed":
      return <XCircle size={14} weight="fill" className="text-red-400" />;
    default:
      return <Warning size={14} weight="fill" className="text-zinc-600" />;
  }
}

export function Codebase() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Map<string, IndexStatus>>(new Map());
  const [indexing, setIndexing] = useState<Set<string>>(new Set());
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [docs, setDocs] = useState<CodebaseDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    const res = await fetch("/api/repos");
    if (res.ok) {
      const data = await res.json();
      setRepos(data);
      for (const r of data as RepoInfo[]) {
        fetchStatus(r.full_name);
      }
    }
    setLoading(false);
  }, []);

  async function fetchStatus(repoName: string) {
    try {
      const res = await fetch(`/api/repos/${encodeURIComponent(repoName)}/index/status`);
      if (res.ok) {
        const data = await res.json() as IndexStatus;
        setStatuses((prev) => { const next = new Map(prev); next.set(repoName, data); return next; });
      }
    } catch {}
  }

  useEffect(() => { fetchRepos(); }, [fetchRepos]);

  async function handleIndex(repoName: string) {
    setIndexing((prev) => new Set(prev).add(repoName));
    setStatuses((prev) => {
      const next = new Map(prev);
      next.set(repoName, { status: "running", step: "queued", progress: 0, error: null });
      return next;
    });
    try {
      await fetch(`/api/repos/${encodeURIComponent(repoName)}/index`, { method: "POST" });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(`/api/repos/${encodeURIComponent(repoName)}/index/status`);
        if (res.ok) {
          const data = await res.json() as IndexStatus;
          setStatuses((prev) => { const next = new Map(prev); next.set(repoName, data); return next; });
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

  async function selectRepo(repoName: string) {
    playClick();
    setSelectedRepo(repoName);
    setSelectedDoc(null);
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/repos/${encodeURIComponent(repoName)}/docs`);
      if (res.ok) {
        setDocs(await res.json());
      } else {
        setDocs([]);
      }
    } catch {
      setDocs([]);
    }
    setDocsLoading(false);
  }

  const selectedStatus = selectedRepo ? statuses.get(selectedRepo) : null;
  const selectedDocContent = selectedDoc
    ? docs.find((d) => d.doc_type === selectedDoc) ?? null
    : null;

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h2 className="font-heading text-2xl font-bold text-zinc-50">Codebase</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Indexed repositories and AI-generated codebase documentation
        </p>
      </header>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* Repo list sidebar */}
        <div className="space-y-3">
          <Panel title="Indexed repos">
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : repos.length === 0 ? (
              <Empty
                icon={<GitBranch size={32} weight="duotone" />}
                title="No repos"
                message="Install Forkbot on a repo and index it to see docs here."
              />
            ) : (
              <div className="divide-y divide-zinc-800">
                {repos.map((repo) => {
                  const s = statuses.get(repo.full_name);
                  const status = s?.status ?? repo.index_status ?? "pending";
                  const isActive = selectedRepo === repo.full_name;
                  return (
                    <button
                      key={repo.id}
                      className={[
                        "w-full flex items-center gap-2.5 py-2 px-1 text-left transition-colors",
                        isActive ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-300",
                      ].join(" ")}
                      onClick={() => selectRepo(repo.full_name)}
                    >
                      <StatusIcon status={status} />
                      <span className="flex-1 text-xs font-mono truncate">{repo.full_name}</span>
                      <Badge
                        variant={status === "indexed" || status === "completed" ? "completed" : status === "running" ? "pending" : status === "failed" ? "error" : "default"}
                        dot={false}
                        size="xs"
                      >
                        {status}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          {selectedRepo && selectedStatus && selectedStatus.status === "running" && (
            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Indexing progress</span>
                <span className="text-zinc-400 font-mono">{selectedStatus.progress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-forkbot-sky rounded-full transition-all duration-500"
                  style={{ width: `${selectedStatus.progress}%` }}
                />
              </div>
              {selectedStatus.step && (
                <p className="text-xs text-zinc-600 capitalize">{selectedStatus.step.replace("_", " ")}</p>
              )}
            </Card>
          )}
        </div>

        {/* Main content */}
        <div className="space-y-4">
          {!selectedRepo ? (
            <Card className="p-12">
              <Empty
                icon={<Book size={40} weight="duotone" />}
                title="Select a repository"
                message="Choose a repo from the list to view its generated documentation."
              />
            </Card>
          ) : docsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <Card className="p-8">
              <Empty
                icon={<FileCode size={36} weight="duotone" />}
                title="No docs yet"
                message={`Click "Index" on ${selectedRepo} to generate codebase documentation.`}
                action={
                  <Button
                    variant="brand"
                    size="sm"
                    iconLeft={<ArrowsClockwise size={12} weight="bold" />}
                    onClick={() => handleIndex(selectedRepo)}
                    loading={indexing.has(selectedRepo)}
                    sound
                  >
                    {indexing.has(selectedRepo) ? "Indexing…" : `Index ${selectedRepo}`}
                  </Button>
                }
              />
            </Card>
          ) : selectedDocContent ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  onClick={() => { playClick(); setSelectedDoc(null); }}
                >
                  ← All docs
                </button>
                <span className="text-xs text-zinc-700">/</span>
                <span className="text-xs text-zinc-300 font-medium">
                  {DOC_TYPE_LABELS[selectedDoc] ?? selectedDoc}
                </span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="text-sm text-zinc-300 leading-relaxed space-y-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-zinc-50 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_h3]:mt-4 [&_p]:text-zinc-400 [&_p]:leading-relaxed [&_code]:text-[13px] [&_code]:font-mono [&_code]:text-forkbot-sky [&_code]:bg-zinc-800/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-zinc-950 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:text-xs [&_pre]:font-mono [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:text-zinc-400 [&_hr]:border-zinc-800 [&_a]:text-forkbot-sky [&_a]:underline [&_a:hover]:text-forkbot-sky/80 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-500 [&_blockquote]:italic [&_strong]:text-zinc-200 [&_em]:text-zinc-300]">
                  {selectedDocContent.content.split("\n").map((line, i) => {
                    // Render markdown headings
                    if (line.startsWith("# ")) return <h1 key={i}>{line.slice(2)}</h1>;
                    if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>;
                    if (line.startsWith("### ")) return <h3 key={i}>{line.slice(4)}</h3>;
                    if (line.startsWith("#### ")) return <h4 key={i} className="text-sm font-semibold text-zinc-200 mt-3">{line.slice(5)}</h4>;
                    if (line.startsWith("- ")) return <li key={i} className="ml-4">{line.slice(2)}</li>;
                    if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ")) return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
                    if (line.startsWith("---")) return <hr key={i} className="my-3" />;
                    if (line.startsWith("> ")) return <blockquote key={i}>{line.slice(2)}</blockquote>;
                    if (line.trim() === "") return <div key={i} className="h-2" />;
                    if (line.startsWith("```")) {
                      // Code block start/end — render as pre
                      const lang = line.slice(3).trim();
                      const codeLines = [];
                      let j = i + 1;
                      while (j < selectedDocContent.content.split("\n").length && !selectedDocContent.content.split("\n")[j].startsWith("```")) {
                        codeLines.push(selectedDocContent.content.split("\n")[j]);
                        j++;
                      }
                      if (codeLines.length > 0) {
                        return <pre key={i}><code>{codeLines.join("\n")}</code></pre>;
                      }
                      return null;
                    }
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Doc type grid */}
              <Panel title={`Docs — ${selectedRepo}`}>
                <div className="grid sm:grid-cols-2 gap-3">
                  {docs.map((doc) => (
                    <button
                      key={doc.doc_type}
                      className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors text-left"
                      onClick={() => { playClick(); setSelectedDoc(doc.doc_type); }}
                    >
                      <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                        {DOC_TYPE_ICONS[doc.doc_type] ?? <FileText size={14} weight="duotone" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200">
                          {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                        </div>
                        <div className="text-xs text-zinc-600">v{doc.version}</div>
                      </div>
                      <FileText size={16} weight="regular" className="text-zinc-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </Panel>

              {/* Index results card */}
              {selectedStatus && selectedStatus.status === "completed" && (
                <Card className="p-4 flex items-center gap-3">
                  <CheckCircle size={20} weight="fill" className="text-forkbot-green shrink-0" />
                  <div>
                    <p className="text-sm text-zinc-200 font-medium">Index complete</p>
                    <p className="text-xs text-zinc-600">
                      AI-generated documentation is ready. Click any doc above to view.
                    </p>
                  </div>
                </Card>
              )}

              {selectedStatus && selectedStatus.status === "failed" && (
                <Card className="p-4 border-red-800/50 flex items-start gap-3">
                  <XCircle size={20} weight="fill" className="text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-300 font-medium">Indexing failed</p>
                    <p className="text-xs text-zinc-500 mt-1">{selectedStatus.error ?? "Unknown error"}</p>
                    <Button
                      variant="secondary"
                      size="xs"
                      className="mt-2"
                      iconLeft={<ArrowsClockwise size={11} weight="bold" />}
                      onClick={() => handleIndex(selectedRepo)}
                      loading={indexing.has(selectedRepo)}
                      sound
                    >
                      Retry
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
