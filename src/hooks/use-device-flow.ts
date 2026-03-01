import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import type { DeviceFlowStart, GitHubUser } from "@/lib/types";
import { useAuthSessionStore } from "@/stores/auth-session-store";
import { useToastStore } from "@/stores/toast-store";

interface DeviceFlowState {
  flow: DeviceFlowStart | null;
  polling: boolean;
  error: string | null;
  copied: boolean;
}

export function useDeviceFlow(rememberSession: boolean) {
  const { setSession } = useAuthSessionStore();
  const addToast = useToastStore((s) => s.addToast);

  const [state, setState] = useState<DeviceFlowState>({
    flow: null, polling: false, error: null, copied: false,
  });
  const pollingRef = useRef(false);
  const rememberRef = useRef(rememberSession);
  rememberRef.current = rememberSession;

  useEffect(() => {
    return () => { pollingRef.current = false; };
  }, []);

  const poll = useCallback(async (deviceCode: string, interval: number) => {
    while (pollingRef.current) {
      await new Promise((r) => setTimeout(r, interval * 1000));
      if (!pollingRef.current) break;

      try {
        const accessToken = await invoke<string>("poll_device_flow", { deviceCode });
        pollingRef.current = false;
        setState({ flow: null, polling: false, error: null, copied: false });

        const user = await invoke<GitHubUser>("authenticate_github", { token: accessToken }).catch(() => null);

        if (rememberRef.current) {
          const stored = await invoke("store_github_token", { token: accessToken }).then(() => true).catch(() => false);
          setSession(accessToken, user?.login ?? null, user?.avatarUrl ?? null, stored);
          if (!stored) addToast("Connected for this session only (could not persist token).", "info");
        } else {
          setSession(accessToken, user?.login ?? null, user?.avatarUrl ?? null, false);
        }

        addToast(`Connected as ${user?.login ?? "GitHub user"}`, "success");
        return;
      } catch (e) {
        const err = String(e);
        if (err === "pending") continue;
        if (err === "slow_down") { interval += 5; continue; }
        pollingRef.current = false;
        setState((s) => ({ ...s, flow: null, polling: false, error: err }));
        return;
      }
    }
  }, [setSession, addToast]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const flow = await invoke<DeviceFlowStart>("start_device_flow");
      setState({ flow, polling: true, error: null, copied: false });
      pollingRef.current = true;
      await open(flow.verificationUri);
      void poll(flow.deviceCode, flow.interval);
    } catch (e) {
      setState((s) => ({ ...s, error: String(e) }));
    }
  }, [poll]);

  const cancel = useCallback(() => {
    pollingRef.current = false;
    setState({ flow: null, polling: false, error: null, copied: false });
  }, []);

  const copyCode = useCallback(async () => {
    if (!state.flow) return;
    await navigator.clipboard.writeText(state.flow.userCode);
    setState((s) => ({ ...s, copied: true }));
    setTimeout(() => setState((s) => ({ ...s, copied: false })), 2000);
  }, [state.flow]);

  const reopenGitHub = useCallback(() => {
    if (state.flow) open(state.flow.verificationUri);
  }, [state.flow]);

  return { ...state, start, cancel, copyCode, reopenGitHub };
}
