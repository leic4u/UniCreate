import { create } from "zustand";
import { useSettingsStore } from "./settings-store";

function getEphemeralTtlMs(): number {
  return useSettingsStore.getState().ephemeralTimeoutMinutes * 60 * 1000;
}

interface AuthSessionStore {
  activeSessionToken: string | null;
  savedSessionUser: string | null;
  savedSessionAvatar: string | null;
  hasSavedSession: boolean;
  ephemeralSessionExpiresAt: number | null;
  setSession: (token: string | null, user: string | null, avatar: string | null, saved: boolean) => void;
  touchEphemeralSession: () => void;
  isEphemeralSessionExpired: () => boolean;
  clearSession: () => void;
}

export const useAuthSessionStore = create<AuthSessionStore>((set, get) => ({
  activeSessionToken: null,
  savedSessionUser: null,
  savedSessionAvatar: null,
  hasSavedSession: false,
  ephemeralSessionExpiresAt: null,

  setSession: (token, user, avatar, saved) =>
    set({
      activeSessionToken: token,
      savedSessionUser: user,
      savedSessionAvatar: avatar,
      hasSavedSession: saved,
      ephemeralSessionExpiresAt: token && !saved ? Date.now() + getEphemeralTtlMs() : null,
    }),

  touchEphemeralSession: () => {
    const state = get();
    if (!state.activeSessionToken || state.hasSavedSession) return;
    set({ ephemeralSessionExpiresAt: Date.now() + getEphemeralTtlMs() });
  },

  isEphemeralSessionExpired: () => {
    const state = get();
    if (!state.activeSessionToken || state.hasSavedSession || !state.ephemeralSessionExpiresAt) {
      return false;
    }
    return Date.now() >= state.ephemeralSessionExpiresAt;
  },

  clearSession: () =>
    set({
      activeSessionToken: null,
      savedSessionUser: null,
      savedSessionAvatar: null,
      hasSavedSession: false,
      ephemeralSessionExpiresAt: null,
    }),
}));
