import { useState, useEffect } from "react";
import { useManifestStore } from "@/stores/manifest-store";
import { useHistoryStore } from "@/stores/history-store";
import { useToastStore } from "@/stores/toast-store";
import { useAuthSessionStore } from "@/stores/auth-session-store";
import { useDeviceFlow } from "@/hooks/use-device-flow";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import type { GitHubUser } from "@/lib/types";
import {
  ArrowLeft, Send, Loader2, ExternalLink, CheckCircle2,
  AlertCircle, Github, Package, FileCode, RotateCcw, Lock, Unlock, Copy, Check,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettingsStore } from "@/stores/settings-store";

export function StepSubmit() {
  const { manifest, generatedYaml, setStep, isSubmitting, setIsSubmitting, reset, isUpdate } = useManifestStore();
  const addSubmission = useHistoryStore((s) => s.addSubmission);
  const addToast = useToastStore((s) => s.addToast);
  const {
    activeSessionToken,
    savedSessionUser,
    hasSavedSession,
    setSession,
    clearSession,
    touchEphemeralSession,
    isEphemeralSessionExpired,
  } = useAuthSessionStore();

  const t = useT();
  const neverSaveSession = useSettingsStore((s) => s.neverSaveSession);
  const [token, setToken] = useState(activeSessionToken ?? "");
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [githubUser, setGithubUser] = useState<string | null>(savedSessionUser ?? null);
  const [rememberToken, setRememberToken] = useState(false);

  const df = useDeviceFlow(neverSaveSession ? false : rememberToken);

  // Sync with shared auth session
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      if (!activeSessionToken) {
        setToken(""); setGithubUser(null);
        return;
      }
      if (!hasSavedSession && isEphemeralSessionExpired()) {
        clearSession();
        if (!cancelled) { setToken(""); setGithubUser(null); addToast("Session locked for security. Please sign in again.", "info"); }
        return;
      }
      setToken(activeSessionToken);
      if (savedSessionUser) { setGithubUser(savedSessionUser); return; }
      try {
        const user = await invoke<GitHubUser>("authenticate_github", { token: activeSessionToken });
        if (cancelled) return;
        setGithubUser(user.login);
        setSession(activeSessionToken, user.login, user.avatarUrl, hasSavedSession);
      } catch {
        if (cancelled) return;
        setToken(""); setGithubUser(null);
        await invoke("clear_github_token").catch(() => {});
        clearSession();
      }
    };
    void sync();
    return () => { cancelled = true; };
  }, [activeSessionToken, savedSessionUser, hasSavedSession, isEphemeralSessionExpired, clearSession, setSession, addToast]);

  // Fallback: load keychain token
  useEffect(() => {
    let mounted = true;
    if (activeSessionToken) return;
    const load = async () => {
      try {
        const stored = await invoke<string | null>("get_github_token");
        if (!mounted || !stored) return;
        setToken(stored); setRememberToken(true);
        setSession(stored, null, null, true);
        try {
          const user = await invoke<GitHubUser>("authenticate_github", { token: stored });
          if (!mounted) return;
          setGithubUser(user.login);
          setSession(stored, user.login, user.avatarUrl, true);
        } catch {
          if (!mounted) return;
          setToken(""); setGithubUser(null);
          await invoke("clear_github_token").catch(() => {});
          clearSession();
        }
      } catch { /* Keyring not available */ }
    };
    void load();
    return () => { mounted = false; };
  }, [activeSessionToken, setSession, clearSession]);

  useEffect(() => { if (hasSavedSession) setRememberToken(true); }, [hasSavedSession]);

  // Sync user when device flow succeeds
  useEffect(() => {
    if (activeSessionToken && !githubUser && savedSessionUser) {
      setToken(activeSessionToken);
      setGithubUser(savedSessionUser);
    }
  }, [activeSessionToken, savedSessionUser, githubUser]);

  const handleDisconnect = async () => {
    setToken(""); setGithubUser(null);
    await invoke("clear_github_token").catch(() => {});
    clearSession();
    addToast("Session disconnected.", "info");
  };

  const handleSubmit = async () => {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("No active GitHub session.");
      addToast("Please sign in with GitHub first.", "info");
      return;
    }
    if (!hasSavedSession) touchEphemeralSession();

    setIsSubmitting(true); setError(null);
    try {
      const url = await invoke<string>("submit_manifest", {
        token: trimmedToken, yamlFiles: generatedYaml,
        packageId: manifest.packageIdentifier, version: manifest.packageVersion,
        isUpdate,
      });
      setPrUrl(url);
      const now = new Date().toISOString();
      addSubmission({
        packageId: manifest.packageIdentifier, version: manifest.packageVersion,
        prUrl: url, date: now, user: githubUser || "",
      });
      // Audit log
      invoke("write_audit_log", {
        entry: `[${now}] user=${githubUser || "unknown"} package=${manifest.packageIdentifier} version=${manifest.packageVersion} pr=${url} type=${isUpdate ? "update" : "new"}`,
      }).catch(() => {});
      addToast("Pull request created successfully.", "success");
    } catch (e) {
      const message = String(e);
      setError(message);
      if (/(invalid token|http 401|401)/i.test(message)) {
        await invoke("clear_github_token").catch(() => {});
        clearSession(); setToken(""); setGithubUser(null);
        addToast("Session expired. Please sign in again.", "info");
      } else {
        addToast("Failed to create pull request.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (prUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-scale-in">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 mb-5">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{t("submit.prCreated")}</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">{manifest.packageIdentifier}</span> v{manifest.packageVersion}
        </p>
        <div className="mt-8 flex items-center gap-3">
          <a href={prUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:brightness-110">
            <ExternalLink className="h-3.5 w-3.5" />{t("submit.viewOnGithub")}
          </a>
          <button onClick={() => { reset(); setPrUrl(null); }}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" />{t("submit.newManifest")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2"><span>{t("submit.step")}</span></div>
        <h2 className="text-xl font-semibold tracking-tight">{t("submit.title")}</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
          {t("submit.desc")}
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card/50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#24292e]">
            <Github className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold">{t("submit.authTitle")}</h3>
            <p className="text-[11px] text-muted-foreground">{t("submit.authDesc")}</p>
          </div>
        </div>

        {!githubUser ? (
          <>
            {df.flow && df.polling ? (
              <div className="space-y-4 animate-fade-in">
                <div className="flex flex-col items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-5">
                  <p className="text-[12px] text-muted-foreground">{t("submit.enterCode")}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">{df.flow.userCode}</span>
                    <button onClick={df.copyCode} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                      {df.copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("submit.waiting")}
                  </div>
                </div>
                <button onClick={df.reopenGitHub} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border text-[13px] font-medium transition-all hover:bg-accent hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />{t("submit.openGithub")}
                </button>
                <button onClick={df.cancel} className="flex h-8 w-full items-center justify-center text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  {t("submit.cancel")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={df.start} className={cn("flex h-10 w-full items-center justify-center gap-2.5 rounded-lg text-[13px] font-medium transition-all", "bg-[#24292e] text-white hover:bg-[#2f363d]")}>
                  <Github className="h-4 w-4" />{t("submit.signIn")}
                </button>
                {!neverSaveSession && (
                  <div className="flex items-center justify-center">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={rememberToken} onChange={(e) => setRememberToken(e.target.checked)} className="h-3 w-3 rounded border-border accent-primary" />
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {rememberToken ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                        {t("submit.remember")}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}
            {df.error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 animate-fade-in">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-destructive shrink-0" />
                <p className="text-[12px] text-destructive/80">{df.error}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/8 border border-emerald-500/15 px-3.5 py-2.5 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[12px] font-medium text-emerald-400">{t("submit.connectedAs")} <strong>{githubUser}</strong></span>
            </div>
            <button onClick={handleDisconnect} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">{t("submit.disconnect")}</button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/50 p-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("submit.summary")}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: t("submit.packageId"), value: manifest.packageIdentifier, icon: Package },
            { label: t("submit.version"), value: manifest.packageVersion, icon: Package },
            { label: t("submit.installers"), value: String(manifest.installers.length), icon: Package },
            { label: t("submit.files"), value: String(generatedYaml.length), icon: FileCode },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
              <span className="ml-auto text-[12px] font-medium text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 animate-fade-in">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-destructive shrink-0" />
          <p className="text-[12px] text-destructive/80">{error}</p>
        </div>
      )}

      <div className="sticky bottom-0 flex items-center justify-between bg-background/95 backdrop-blur-sm pt-4 pb-2 -mx-6 px-6">
        <button onClick={() => setStep("review")} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />{t("submit.back")}
        </button>
        <button onClick={handleSubmit} disabled={!githubUser || isSubmitting} data-action="primary"
          className={cn("flex items-center gap-2 rounded-lg px-5 py-2 text-[13px] font-medium transition-all duration-200", "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]", "disabled:cursor-not-allowed disabled:opacity-40")}>
          {isSubmitting ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("submit.creatingPr")}</>) : (<><Send className="h-3.5 w-3.5" />{t("submit.submitPr")}</>)}
        </button>
      </div>
    </div>
  );
}

export default StepSubmit;
