import { useEffect, useRef, useState } from "react";
import { useAuthSessionStore } from "@/stores/auth-session-store";
import { useHistoryStore } from "@/stores/history-store";
import { useToastStore } from "@/stores/toast-store";
import { useDeviceFlow } from "@/hooks/use-device-flow";
import type { RecoveredPr, SubmissionEntry } from "@/lib/types";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import {
  Github, LogOut, RefreshCw, Loader2, Copy, Check,
  ExternalLink, X, Lock, Unlock,
} from "lucide-react";

function parseRecoveredPr(pr: RecoveredPr): SubmissionEntry {
  const match = pr.title.match(/^New version:\s+(.+?)\s+version\s+(.+)$/i);
  return {
    packageId: match?.[1]?.trim() || pr.title,
    version: match?.[2]?.trim() || "-",
    prUrl: pr.pr_url,
    date: pr.created_at,
    user: pr.user_login,
  };
}

export function ProfileButton() {
  const {
    activeSessionToken,
    savedSessionUser,
    savedSessionAvatar,
    hasSavedSession,
    setSession,
    clearSession,
    touchEphemeralSession,
    isEphemeralSessionExpired,
  } = useAuthSessionStore();
  const { mergeRecoveredSubmissions } = useHistoryStore();
  const addToast = useToastStore((s) => s.addToast);

  const [showDropdown, setShowDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [flowStarted, setFlowStarted] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const df = useDeviceFlow(rememberSession);

  // Load saved session on mount
  useEffect(() => {
    let mounted = true;
    const loadSavedSession = async () => {
      try {
        const token = await invoke<string | null>("get_github_token");
        if (!mounted) return;
        if (!token) {
          const current = useAuthSessionStore.getState();
          if (current.activeSessionToken) {
            setSession(current.activeSessionToken, current.savedSessionUser, current.savedSessionAvatar, false);
            return;
          }
          clearSession();
          return;
        }
        setSession(token, null, null, true);
        const user = await invoke<{ login: string; avatarUrl: string }>("authenticate_github", { token }).catch(() => null);
        if (!mounted) return;
        if (user) setSession(token, user.login, user.avatarUrl, true);
      } catch {
        if (!mounted) return;
        const current = useAuthSessionStore.getState();
        if (!current.activeSessionToken) clearSession();
      }
    };
    void loadSavedSession();
    return () => { mounted = false; };
  }, [setSession, clearSession]);

  // Ephemeral session auto-lock
  useEffect(() => {
    let handled = false;
    const timer = setInterval(() => {
      const state = useAuthSessionStore.getState();
      if (!state.activeSessionToken || state.hasSavedSession) return;
      if (!state.isEphemeralSessionExpired() || handled) return;
      handled = true;
      state.clearSession();
      addToast("Session locked for security. Please sign in again.", "info");
    }, 5000);
    return () => clearInterval(timer);
  }, [addToast]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  // Close modal when device flow succeeds (only after flow was actually started)
  useEffect(() => {
    if (df.polling || df.flow) setFlowStarted(true);
    if (flowStarted && !df.polling && !df.flow && showAuthModal && !df.error) {
      setShowAuthModal(false);
      setFlowStarted(false);
    }
  }, [df.polling, df.flow, df.error, showAuthModal, flowStarted]);

  const handleDisconnect = async () => {
    setShowDropdown(false);
    await invoke("clear_github_token").catch(() => {});
    clearSession();
    addToast("Session disconnected.", "info");
  };

  const handleRecoverPrs = async () => {
    if (!activeSessionToken) return;
    if (!hasSavedSession && isEphemeralSessionExpired()) {
      clearSession();
      addToast("Session expired. Please sign in again.", "info");
      return;
    }
    setIsRecovering(true);
    try {
      const recovered = await invoke<RecoveredPr[]>("fetch_unicreate_recent_prs", { token: activeSessionToken, limit: 10 });
      mergeRecoveredSubmissions(recovered.map(parseRecoveredPr), 10);
      if (!hasSavedSession) touchEphemeralSession();
      addToast(recovered.length ? `${recovered.length} PR(s) recovered.` : "No UniCreate PRs found.", recovered.length ? "success" : "info");
    } catch (e) {
      const message = String(e);
      if (/(invalid token|http 401|401)/i.test(message)) {
        await invoke("clear_github_token").catch(() => {});
        clearSession();
        addToast("Session expired. Please sign in again.", "info");
      } else {
        addToast(`Failed to recover PRs: ${message}`, "error");
      }
    } finally {
      setIsRecovering(false);
    }
  };

  const isConnected = !!activeSessionToken && !!savedSessionUser;

  return (
    <>
      <div className="relative flex items-center mr-1" data-no-drag ref={dropdownRef}>
        {isConnected ? (
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-border/60 hover:ring-primary/40 transition-all overflow-hidden"
            title={`@${savedSessionUser}`}
          >
            {savedSessionAvatar ? (
              <img src={savedSessionAvatar} alt={savedSessionUser ?? ""} className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                {savedSessionUser?.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Github className="h-3 w-3" />
            Connect
          </button>
        )}

        {showDropdown && isConnected && (
          <div className="absolute right-0 top-9 z-50 w-52 rounded-lg border border-border bg-card shadow-xl animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2.5">
              {savedSessionAvatar ? (
                <img src={savedSessionAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[12px] font-bold text-primary">
                  {savedSessionUser?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-foreground">@{savedSessionUser}</p>
                <p className="text-[10px] text-muted-foreground">{hasSavedSession ? "Saved session" : "Ephemeral session"}</p>
              </div>
            </div>
            <div className="py-1">
              <button
                onClick={() => { setShowDropdown(false); void handleRecoverPrs(); }}
                disabled={isRecovering}
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRecovering && "animate-spin")} />
                {isRecovering ? "Recovering..." : "Recover PRs"}
              </button>
              <button
                onClick={handleDisconnect}
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" data-no-drag>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#24292e]">
                  <Github className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold">Sign in with GitHub</h3>
                  <p className="text-[11px] text-muted-foreground">Use GitHub Device Flow</p>
                </div>
              </div>
              <button onClick={() => { df.cancel(); setShowAuthModal(false); setFlowStarted(false); }} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {df.flow && df.polling ? (
              <div className="space-y-3 animate-fade-in">
                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[12px] text-muted-foreground">Enter this code on GitHub:</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-lg font-bold tracking-[0.2em] text-foreground">{df.flow.userCode}</span>
                    <button onClick={df.copyCode} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      {df.copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Waiting for authorization...
                  </div>
                </div>
                <button onClick={df.reopenGitHub} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border text-[13px] font-medium transition-all hover:bg-accent hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open GitHub again
                </button>
                <button onClick={() => { df.cancel(); setShowAuthModal(false); setFlowStarted(false); }} className="flex h-8 w-full items-center justify-center text-[12px] text-muted-foreground transition-colors hover:text-foreground">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={df.start} className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg bg-[#24292e] text-[13px] font-medium text-white transition-all hover:bg-[#2f363d]">
                  <Github className="h-4 w-4" />
                  Sign in with GitHub
                </button>
                <div className="flex items-center justify-center">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={rememberSession} onChange={(e) => setRememberSession(e.target.checked)} className="h-3 w-3 rounded border-border accent-primary" />
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {rememberSession ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                      Remember session
                    </span>
                  </label>
                </div>
              </div>
            )}

            {df.error && <p className="mt-3 text-[12px] text-destructive">{df.error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
