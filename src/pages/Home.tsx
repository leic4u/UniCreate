import { useEffect, useRef, useState } from "react";
import { useManifestStore } from "@/stores/manifest-store";
import { useHistoryStore } from "@/stores/history-store";
import { useToastStore } from "@/stores/toast-store";
import { useAuthSessionStore } from "@/stores/auth-session-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useT } from "@/lib/i18n";
import type { ExistingManifest, PrLiveStatus } from "@/lib/types";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import {
  Plus, RefreshCw, Loader2, Search, CheckCircle2,
  AlertCircle, ExternalLink, Clock, Trash2,
} from "lucide-react";
import logoTextDarkUrl from "@/assets/logo-text.png";
import logoTextLightUrl from "@/assets/logo-text-light.png";

function parseWingetPkgsUrl(url: string): string | null {
  const match = url.match(/winget-pkgs\/(?:tree|blob)\/\w+\/manifests\/\w\/([^/]+)\/([^/]+)/);
  if (match) return `${match[1]}.${match[2]}`;
  return null;
}

export function Home() {
  const { setStep, setIsUpdate, applyExistingManifest, reset } = useManifestStore();
  const { submissions, recentPackageIds, clearHistory, removeSubmission } = useHistoryStore();
  const { activeSessionToken } = useAuthSessionStore();
  const addToast = useToastStore((s) => s.addToast);
  const maxRecent = useSettingsStore((s) => s.maxRecentSubmissions);
  const t = useT();
  const [mode, setMode] = useState<"choice" | "update">("choice");
  const [packageId, setPackageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<ExistingManifest | null>(null);
  const [prStatuses, setPrStatuses] = useState<Record<string, PrLiveStatus>>({});
  const [isStatusRefreshing, setIsStatusRefreshing] = useState(false);
  const statusRefreshRef = useRef(false);
  const [mergedPackageIds, setMergedPackageIds] = useState<string[]>([]);
  const [loadingMerged, setLoadingMerged] = useState(false);

  const refreshPrStatuses = async () => {
    if (!activeSessionToken) {
      setPrStatuses({});
      return;
    }

    const visible = submissions.slice(0, maxRecent);
    if (!visible.length) {
      setPrStatuses({});
      return;
    }
    if (statusRefreshRef.current) return;

    statusRefreshRef.current = true;
    setIsStatusRefreshing(true);
    try {
      const statuses = await invoke<PrLiveStatus[]>("fetch_pr_statuses", {
        prUrls: visible.map((entry) => entry.prUrl),
        token: activeSessionToken,
      });
      const next: Record<string, PrLiveStatus> = {};
      for (const status of statuses) {
        next[status.prUrl] = status;
      }
      setPrStatuses(next);
    } catch {
      // keep the list usable even if live status refresh fails
    } finally {
      statusRefreshRef.current = false;
      setIsStatusRefreshing(false);
    }
  };

  useEffect(() => {
    if (!activeSessionToken) {
      setPrStatuses({});
      return;
    }
    if (!submissions.length) {
      setPrStatuses({});
      return;
    }

    void refreshPrStatuses();
    const timer = setInterval(() => {
      void refreshPrStatuses();
    }, 30000);

    return () => clearInterval(timer);
  }, [activeSessionToken, submissions]);

  const bb = "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold";
  const bn = `${bb} border-border bg-muted/40 text-muted-foreground`;

  const statusBadges: Record<string, { label: string; className: string }> = {
    merged: { label: "Merged", className: `${bb} border-emerald-500/25 bg-emerald-500/10 text-emerald-500` },
    open:   { label: "Open",   className: `${bb} border-primary/25 bg-primary/10 text-primary` },
    closed: { label: "Closed", className: `${bb} border-destructive/25 bg-destructive/10 text-destructive` },
  };

  const mergeableBadges: Record<string, { label: string; className: string }> = {
    clean:    { label: "Ready",          className: `${bb} border-emerald-500/25 bg-emerald-500/10 text-emerald-500` },
    blocked:  { label: "Pending review", className: `${bb} border-sky-500/25 bg-sky-500/10 text-sky-400` },
    behind:   { label: "Behind",         className: `${bb} border-yellow-500/25 bg-yellow-500/10 text-yellow-400` },
    draft:    { label: "Draft",          className: `${bb} border-violet-500/25 bg-violet-500/10 text-violet-400` },
    dirty:    { label: "Conflicts",      className: `${bb} border-red-500/25 bg-red-500/10 text-red-400` },
    unstable: { label: "Checks failing", className: `${bb} border-orange-500/25 bg-orange-500/10 text-orange-400` },
  };

  const getPrStatusUi = (status: PrLiveStatus | undefined) => {
    if (!status) return { label: "Checking...", className: bn };
    return statusBadges[status.status] ?? { label: "Unknown", className: bn };
  };

  const getPrMergeableUi = (status: PrLiveStatus | undefined) => {
    if (!status || status.status !== "open") return null;
    const state = (status.mergeableState || "").toLowerCase();
    if (!state || state === "unknown") return { label: "Syncing", title: "GitHub is still computing mergeability", className: bn };
    const entry = mergeableBadges[state];
    if (!entry) return { label: state, title: `Mergeable state: ${state}`, className: bn };
    return { label: entry.label, title: `Mergeable state: ${state}`, className: entry.className };
  };

  // Fetch merged PRs from GitHub when entering update mode
  useEffect(() => {
    if (mode !== "update" || !activeSessionToken) {
      setMergedPackageIds([]);
      return;
    }
    let cancelled = false;
    const fetchMerged = async () => {
      setLoadingMerged(true);
      try {
        const prs = await invoke<{ pr_url: string; title: string; created_at: string; user_login: string }[]>(
          "fetch_unicreate_recent_prs", { token: activeSessionToken, limit: 20 }
        );
        if (cancelled) return;
        const ids = new Set<string>();
        for (const pr of prs) {
          const match = pr.title.match(/^New (?:version|package):\s+(.+?)\s+version\s+.+$/i);
          if (match?.[1]) ids.add(match[1].trim());
        }
        setMergedPackageIds([...ids]);
      } catch {
        if (!cancelled) setMergedPackageIds([]);
      } finally {
        if (!cancelled) setLoadingMerged(false);
      }
    };
    void fetchMerged();
    return () => { cancelled = true; };
  }, [mode, activeSessionToken]);

  const handleNew = () => {
    reset();
    setIsUpdate(false);
    setStep("installer");
  };

  const handleInputChange = (value: string) => {
    setPackageId(value);
    setFound(null);
    setError(null);
    if (value.includes("winget-pkgs")) {
      const parsed = parseWingetPkgsUrl(value);
      if (parsed) {
        setPackageId(parsed);
        addToast(`Detected: ${parsed}`, "info");
      }
    }
  };

  const searchPackage = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    setFound(null);
    try {
      const existing = await invoke<ExistingManifest>("fetch_existing_manifest", { packageId: id.trim(), token: activeSessionToken ?? null });
      setFound(existing);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => searchPackage(packageId);

  const handleQuickSelect = (id: string) => {
    setPackageId(id);
    searchPackage(id);
  };

  const handleUpdate = () => {
    if (!found) return;
    reset();
    setIsUpdate(true);
    applyExistingManifest(found);
    setStep("installer");
  };

  if (mode === "update") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("home.updateExisting")}</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
            {t("home.updateExisting.desc")}
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card/50 p-5">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground">{t("home.packageIdOrUrl")}</label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary/60 transition-colors" />
              <input type="text" value={packageId}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={t("home.searchPlaceholder")}
                className="h-10 w-full rounded-lg border border-border bg-background/50 pl-10 pr-4 text-[13px] placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all" />
            </div>
          </div>

          {(() => {
            if (loadingMerged) return (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{t("home.loadingPackages")}</span>
              </div>
            );
            if (!mergedPackageIds.length && !recentPackageIds.length) return null;
            const allIds = [...new Set([...mergedPackageIds, ...recentPackageIds])];
            return (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">{t("home.yourPackages")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {allIds.map((id) => (
                    <button key={id} onClick={() => handleQuickSelect(id)} disabled={loading}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all",
                        packageId === id
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}>
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <button onClick={handleSearch} disabled={!packageId.trim() || loading}
            className={cn("flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-all duration-200",
              "bg-primary text-white hover:brightness-110 active:scale-[0.99]", "disabled:cursor-not-allowed disabled:opacity-40")}>
            {loading ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("home.searching")}</>) : (<><Search className="h-3.5 w-3.5" />{t("home.search")}</>)}
          </button>

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 animate-fade-in">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-destructive shrink-0" />
              <p className="text-[12px] text-destructive/80">{error}</p>
            </div>
          )}

          {found && (
            <div className="space-y-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-4 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-[13px] font-semibold text-emerald-400">{t("home.packageFound")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: t("home.package"), value: found.packageIdentifier },
                  { label: t("home.latestVersion"), value: found.latestVersion },
                  { label: t("home.publisher"), value: found.publisher },
                  { label: t("home.name"), value: found.packageName },
                  { label: t("home.license"), value: found.license },
                  { label: t("home.locale"), value: found.packageLocale },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 rounded-md bg-background/30 px-3 py-1.5">
                    <span className="text-[11px] text-muted-foreground">{item.label}</span>
                    <span className="ml-auto text-[12px] font-medium text-foreground truncate">{item.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{t("home.allMetadataLoaded")}</p>
              <button onClick={handleUpdate}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-[13px] font-medium text-white transition-all hover:bg-emerald-500 active:scale-[0.99]">
                <RefreshCw className="h-3.5 w-3.5" />{t("home.updateThisPackage")}
              </button>
            </div>
          )}
        </div>

        <button onClick={() => setMode("choice")} className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          &larr; {t("home.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-1 pb-4 animate-scale-in">
      <img
        src={logoTextLightUrl}
        alt="UniCreate"
        className="mb-4 h-auto w-[170px] max-w-[72vw] object-contain dark:hidden sm:w-[220px] md:w-[260px]"
      />
      <img
        src={logoTextDarkUrl}
        alt="UniCreate"
        className="mb-4 hidden h-auto w-[170px] max-w-[72vw] object-contain dark:block sm:w-[220px] md:w-[260px]"
      />
      <p className="text-[13px] text-muted-foreground/70 text-center max-w-sm">
        {t("home.tagline")}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-md">
        <button onClick={handleNew}
          className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card/50 p-4 transition-all hover:border-primary/30 hover:bg-card/80">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold">{t("home.newPackage")}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t("home.newPackage.desc")}</p>
          </div>
        </button>

        <button onClick={() => { reset(); setMode("update"); }}
          className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card/50 p-4 transition-all hover:border-emerald-500/30 hover:bg-card/80">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/15">
            <RefreshCw className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold">{t("home.updatePackage")}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t("home.updatePackage.desc")}</p>
          </div>
        </button>
      </div>

      <div className="mt-6 w-full max-w-md">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <Clock className="h-3 w-3" />{t("home.recentSubmissions")}
          </h3>
          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            {activeSessionToken && (
              <span
                title={isStatusRefreshing ? "Refreshing PR status" : "PR status live"}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground/80"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isStatusRefreshing ? "bg-primary animate-pulse" : "bg-emerald-500"
                  )}
                />
                <span>{isStatusRefreshing ? t("common.sync") : t("common.live")}</span>
              </span>
            )}
            <button
              onClick={clearHistory}
              disabled={!submissions.length}
              className="text-[10px] text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {submissions.length ? (
          <div className="space-y-1.5">
            {submissions.slice(0, maxRecent).map((sub, idx) => (
              <a
                key={idx}
                href={sub.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/30 px-3.5 py-2.5 transition-colors hover:bg-card/60 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">
                    {sub.packageId} <span className="text-muted-foreground">v{sub.version}</span>
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <p className="text-[10px] text-muted-foreground">{new Date(sub.date).toLocaleDateString()}</p>
                    {activeSessionToken && (() => {
                      const prStatus = prStatuses[sub.prUrl];
                      const badge = getPrStatusUi(prStatus);
                      const mergeableBadge = getPrMergeableUi(prStatus);
                      return (
                        <>
                          <span className={badge.className}>{badge.label}</span>
                          {mergeableBadge && (
                            <span
                              title={mergeableBadge.title}
                              className={mergeableBadge.className}
                            >
                              {mergeableBadge.label}
                            </span>
                          )}
                          {prStatus?.hasIssues && prStatus.status !== "merged" && (
                            <span
                              title={prStatus.mergeableState || undefined}
                              className="rounded-full border border-red-500/25 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-400"
                            >
                              Needs action
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      removeSubmission(sub.prUrl);
                    }}
                    title="Remove from history"
                    className="rounded-md p-1 text-muted-foreground/60 opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 bg-card/20 px-3.5 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              {t("home.noSubmissions")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
