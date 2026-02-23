import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SubmissionEntry } from "@/lib/types";

interface UserHistory {
  submissions: SubmissionEntry[];
  recentPackageIds: string[];
}

interface HistoryStore {
  /** Per-user history keyed by GitHub username */
  users: Record<string, UserHistory>;
  /** Currently active GitHub username (set externally) */
  activeUser: string | null;

  // Computed accessors for the active user
  submissions: SubmissionEntry[];
  recentPackageIds: string[];

  setActiveUser: (user: string | null) => void;
  addSubmission: (entry: SubmissionEntry) => void;
  removeSubmission: (prUrl: string) => void;
  mergeRecoveredSubmissions: (entries: SubmissionEntry[], maxItems: number) => void;
  clearHistory: () => void;
}

function getUserHistory(users: Record<string, UserHistory>, user: string | null): UserHistory {
  if (!user) return { submissions: [], recentPackageIds: [] };
  return users[user] || { submissions: [], recentPackageIds: [] };
}

function refreshComputed(users: Record<string, UserHistory>, user: string | null) {
  const h = getUserHistory(users, user);
  return { submissions: h.submissions, recentPackageIds: h.recentPackageIds };
}

export const useHistoryStore = create<HistoryStore>()(persist((set) => ({
  users: {},
  activeUser: null,
  submissions: [],
  recentPackageIds: [],

  setActiveUser: (user) =>
    set((s) => ({ activeUser: user, ...refreshComputed(s.users, user) })),

  addSubmission: (entry) =>
    set((s) => {
      const user = s.activeUser;
      if (!user) return {};
      const h = getUserHistory(s.users, user);
      const ids = h.recentPackageIds.includes(entry.packageId)
        ? h.recentPackageIds
        : [entry.packageId, ...h.recentPackageIds].slice(0, 20);
      const updated: UserHistory = { submissions: [entry, ...h.submissions], recentPackageIds: ids };
      const users = { ...s.users, [user]: updated };
      return { users, ...refreshComputed(users, user) };
    }),

  removeSubmission: (prUrl) =>
    set((s) => {
      const user = s.activeUser;
      if (!user) return {};
      const h = getUserHistory(s.users, user);
      const updated: UserHistory = { ...h, submissions: h.submissions.filter((e) => e.prUrl !== prUrl) };
      const users = { ...s.users, [user]: updated };
      return { users, ...refreshComputed(users, user) };
    }),

  mergeRecoveredSubmissions: (entries, maxItems) =>
    set((s) => {
      const user = s.activeUser;
      if (!user) return {};
      const h = getUserHistory(s.users, user);
      const max = Math.min(Math.max(maxItems, 1), 10);
      const byUrl = new Map<string, SubmissionEntry>();

      for (const entry of [...entries, ...h.submissions]) {
        const current = byUrl.get(entry.prUrl);
        if (!current) {
          byUrl.set(entry.prUrl, entry);
          continue;
        }
        const currentTime = Number.isNaN(Date.parse(current.date)) ? 0 : Date.parse(current.date);
        const entryTime = Number.isNaN(Date.parse(entry.date)) ? 0 : Date.parse(entry.date);
        if (entryTime > currentTime) {
          byUrl.set(entry.prUrl, entry);
        }
      }

      const sorted = [...byUrl.values()].sort((a, b) => {
        const aTime = Number.isNaN(Date.parse(a.date)) ? 0 : Date.parse(a.date);
        const bTime = Number.isNaN(Date.parse(b.date)) ? 0 : Date.parse(b.date);
        return bTime - aTime;
      });

      const existingIds = new Set(h.recentPackageIds);
      const newIds = [...h.recentPackageIds];
      for (const entry of sorted) {
        if (!existingIds.has(entry.packageId)) {
          existingIds.add(entry.packageId);
          newIds.push(entry.packageId);
        }
      }

      const updated: UserHistory = { submissions: sorted.slice(0, max), recentPackageIds: newIds.slice(0, 20) };
      const users = { ...s.users, [user]: updated };
      return { users, ...refreshComputed(users, user) };
    }),

  clearHistory: () =>
    set((s) => {
      const user = s.activeUser;
      if (!user) return {};
      const updated: UserHistory = { submissions: [], recentPackageIds: [] };
      const users = { ...s.users, [user]: updated };
      return { users, ...refreshComputed(users, user) };
    }),
}), {
  name: "unicreate-history",
  partialize: (state) => ({
    users: state.users,
  }),
}));
