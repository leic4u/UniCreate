import { useEffect, useState, useMemo } from "react";
import { useManifestStore } from "@/stores/manifest-store";
import { useAuthSessionStore } from "@/stores/auth-session-store";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Pencil,
  FileCode,
  Download,
  Loader2,
  GitCompareArrows,
  Eye,
  RefreshCw,
} from "lucide-react";
import type { YamlFile } from "@/lib/types";
import { useT } from "@/lib/i18n";

function computeDiffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to produce diff
  let i = m, j = n;
  const ops: Array<{ type: "same" | "add" | "remove"; line: string }> = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: "same", line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "add", line: newLines[j - 1] });
      j--;
    } else {
      ops.push({ type: "remove", line: oldLines[i - 1] });
      i--;
    }
  }
  ops.reverse();

  let oldLineNum = 0, newLineNum = 0;
  for (const op of ops) {
    if (op.type === "same") {
      oldLineNum++; newLineNum++;
      result.push({ type: "same", content: op.line, oldNum: oldLineNum, newNum: newLineNum });
    } else if (op.type === "remove") {
      oldLineNum++;
      result.push({ type: "remove", content: op.line, oldNum: oldLineNum, newNum: null });
    } else {
      newLineNum++;
      result.push({ type: "add", content: op.line, oldNum: null, newNum: newLineNum });
    }
  }

  return result;
}

interface DiffLine {
  type: "same" | "add" | "remove";
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

function DiffViewer({ oldContent, newContent, noChangesLabel }: { oldContent: string; newContent: string; noChangesLabel: string }) {
  const lines = useMemo(() => computeDiffLines(oldContent, newContent), [oldContent, newContent]);
  const stats = useMemo(() => {
    let added = 0, removed = 0;
    for (const l of lines) {
      if (l.type === "add") added++;
      else if (l.type === "remove") removed++;
    }
    return { added, removed };
  }, [lines]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[11px] font-medium">
        {stats.added > 0 && <span className="text-emerald-400">+{stats.added}</span>}
        {stats.removed > 0 && <span className="text-red-400">-{stats.removed}</span>}
        {stats.added === 0 && stats.removed === 0 && <span className="text-muted-foreground">{noChangesLabel}</span>}
      </div>
      <div className="overflow-x-auto font-mono text-[12px] leading-[1.7]">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              "flex",
              line.type === "add" && "bg-emerald-500/10",
              line.type === "remove" && "bg-red-500/10"
            )}
          >
            <span className="w-10 shrink-0 select-none text-right pr-2 text-muted-foreground/40 text-[11px]">
              {line.oldNum ?? ""}
            </span>
            <span className="w-10 shrink-0 select-none text-right pr-2 text-muted-foreground/40 text-[11px]">
              {line.newNum ?? ""}
            </span>
            <span className={cn(
              "w-4 shrink-0 select-none text-center text-[11px] font-bold",
              line.type === "add" && "text-emerald-400",
              line.type === "remove" && "text-red-400",
              line.type === "same" && "text-transparent"
            )}>
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            <span className={cn(
              "flex-1 whitespace-pre",
              line.type === "add" && "text-emerald-300",
              line.type === "remove" && "text-red-300",
              line.type === "same" && "text-[hsl(222.2,84%,4.9%)] dark:text-[hsl(220,20%,95%)]"
            )}>
              {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepReview() {
  const { manifest, generatedYaml, setGeneratedYaml, setStep, isUpdate, previousVersion } = useManifestStore();
  const activeSessionToken = useAuthSessionStore((s) => s.activeSessionToken);
  const t = useT();
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Diff state (update mode only)
  const [showDiff, setShowDiff] = useState(false);
  const [oldYaml, setOldYaml] = useState<YamlFile[]>([]);
  const [loadingOld, setLoadingOld] = useState(false);
  const [oldError, setOldError] = useState<string | null>(null);

  useEffect(() => {
    const generate = async () => {
      setLoading(true);
      setError(null);
      try {
        const files = await invoke<{ fileName: string; content: string }[]>("generate_yaml", { manifest });
        setGeneratedYaml(files);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    generate();
  }, [manifest, setGeneratedYaml]);

  // Fetch old YAML when diff mode is enabled
  useEffect(() => {
    if (!isUpdate || !showDiff || oldYaml.length > 0) return;
    let cancelled = false;
    const fetchOld = async () => {
      setLoadingOld(true);
      setOldError(null);
      try {
        const files = await invoke<YamlFile[]>("fetch_existing_yaml_files", {
          packageId: manifest.packageIdentifier,
          version: previousVersion || manifest.packageVersion,
          token: activeSessionToken ?? null,
        });
        if (!cancelled) setOldYaml(files);
      } catch {
        // If we can't fetch old YAML (e.g. first version update), try previous version
        // Just show empty for now
        if (!cancelled) setOldError("couldNotFetch");
      } finally {
        if (!cancelled) setLoadingOld(false);
      }
    };
    void fetchOld();
    return () => { cancelled = true; };
  }, [isUpdate, showDiff, oldYaml.length, manifest.packageIdentifier, previousVersion, manifest.packageVersion, activeSessionToken]);

  const getOldContent = (newFileName: string): string | null => {
    // Try exact match first
    const exact = oldYaml.find((f) => f.fileName === newFileName);
    if (exact) return exact.content;
    // Try matching by type (installer, locale, version)
    const getType = (name: string) => {
      if (name.includes(".installer.")) return "installer";
      if (name.includes(".locale.")) return "locale:" + (name.match(/\.locale\.(.+)\.yaml$/)?.[1] || "");
      return "version";
    };
    const newType = getType(newFileName);
    const match = oldYaml.find((f) => getType(f.fileName) === newType);
    return match?.content ?? null;
  };

  const handleCopy = async () => {
    if (!generatedYaml[activeTab]) return;
    await navigator.clipboard.writeText(generatedYaml[activeTab].content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditActiveYaml = (content: string) => {
    const current = generatedYaml[activeTab];
    if (!current) return;
    const files = [...generatedYaml];
    files[activeTab] = { ...current, content };
    setGeneratedYaml(files);
  };

  const handleSave = async () => {
    try {
      await invoke("save_yaml_files", {
        files: generatedYaml,
        packageId: manifest.packageIdentifier,
        version: manifest.packageVersion,
      });
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
        <span className="text-[13px] text-muted-foreground">{t("review.generating")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-[13px] text-destructive">{error}</p>
        </div>
        <button onClick={() => setStep("metadata")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("review.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <span>{t("review.step")}</span>
            {isUpdate && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <RefreshCw className="h-2.5 w-2.5" />{t("common.update")}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold tracking-tight">{t("review.title")}</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
            {t("review.desc")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isUpdate && (
            <button
              onClick={() => { setShowDiff(!showDiff); setIsEditing(false); }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                showDiff
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-foreground/70 hover:bg-accent hover:text-foreground"
              )}
            >
              {showDiff ? <Eye className="h-3 w-3" /> : <GitCompareArrows className="h-3 w-3" />}
              {showDiff ? t("review.preview") : t("review.diff")}
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="h-3 w-3" />
            {t("review.saveToDesktop")}
          </button>
        </div>
      </div>

      {/* Code viewer */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center border-b border-border bg-card/30">
          <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
            {generatedYaml.map((file, index) => {
              const parts = file.fileName.replace(/\.yaml$/, "").split(".");
              const label = parts.length > 2 ? parts.slice(2).join(".") : parts[parts.length - 1];
              return (
                <button
                  key={file.fileName}
                  onClick={() => { setActiveTab(index); setCopied(false); }}
                  title={file.fileName}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0",
                    index === activeTab
                      ? "border-primary text-foreground bg-background/50"
                      : "border-transparent text-muted-foreground hover:text-muted-foreground"
                  )}
                >
                  <FileCode className="h-3 w-3 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
          {!showDiff && (
            <button
              onClick={() => setIsEditing((v) => !v)}
              className={cn(
                "mx-2 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors shrink-0",
                isEditing
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Pencil className="h-3 w-3" />
              {isEditing ? t("review.done") : t("review.editYaml")}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="mx-2 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-500">{t("review.copied")}</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                {t("review.copy")}
              </>
            )}
          </button>
        </div>

        {/* Code / Diff */}
        <div className="bg-[hsl(210,40%,98%)] dark:bg-[hsl(228,14%,7%)] p-5 overflow-x-auto">
          {showDiff ? (
            loadingOld ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary/60" />
                <span className="text-[12px] text-muted-foreground">{t("review.fetchingOld")}</span>
              </div>
            ) : oldError ? (
              <div className="py-4 text-center">
                <p className="text-[12px] text-muted-foreground">{t("review.couldNotFetch")}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">{t("review.showingAsNew")}</p>
                <div className="mt-3">
                  <DiffViewer oldContent="" newContent={generatedYaml[activeTab]?.content || ""} noChangesLabel={t("review.noChanges")} />
                </div>
              </div>
            ) : (
              <DiffViewer
                oldContent={getOldContent(generatedYaml[activeTab]?.fileName || "") || ""}
                newContent={generatedYaml[activeTab]?.content || ""}
                noChangesLabel={t("review.noChanges")}
              />
            )
          ) : isEditing ? (
            <textarea
              value={generatedYaml[activeTab]?.content || ""}
              onChange={(e) => handleEditActiveYaml(e.target.value)}
              spellCheck={false}
              className="min-h-[420px] w-full resize-y rounded-lg border border-border bg-background/70 p-3 font-mono text-[12px] leading-[1.7] text-[hsl(222.2,84%,4.9%)] dark:text-[hsl(220,20%,95%)] focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          ) : (
            <pre className="text-[12px] leading-[1.7] font-mono">
              <code className="text-[hsl(222.2,84%,4.9%)] dark:text-[hsl(220,20%,95%)]">
                {generatedYaml[activeTab]?.content}
              </code>
            </pre>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => setStep("metadata")}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("review.back")}
        </button>
        <button
          onClick={() => setStep("submit")}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          {t("review.continue")}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
