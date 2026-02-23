import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserRepoInfo, RepoReleaseInfo } from "@/lib/types";

export function useUserRepos(token: string | null, enabled: boolean) {
  const [repos, setRepos] = useState<UserRepoInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [releases, setReleases] = useState<Record<string, RepoReleaseInfo[]>>({});
  const [loadingReleases, setLoadingReleases] = useState<Set<string>>(new Set());
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !token) {
      setRepos([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    invoke<UserRepoInfo[]>("fetch_user_repos", { token, limit: 15 })
      .then((r) => { if (!cancelled) setRepos(r); })
      .catch(() => { if (!cancelled) setRepos([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, token]);

  const fetchReleases = useCallback(async (repo: UserRepoInfo) => {
    const key = repo.fullName;
    if (releases[key] || loadingReleases.has(key)) return;
    setLoadingReleases((prev) => new Set(prev).add(key));
    try {
      const r = await invoke<RepoReleaseInfo[]>("fetch_repo_releases", { owner: repo.owner, repo: repo.name, count: 2 });
      setReleases((prev) => ({ ...prev, [key]: r }));
    } catch {
      setReleases((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingReleases((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [releases, loadingReleases]);

  const toggleRepo = useCallback((repo: UserRepoInfo) => {
    const key = repo.fullName;
    if (expandedRepo === key) {
      setExpandedRepo(null);
    } else {
      setExpandedRepo(key);
      void fetchReleases(repo);
    }
  }, [expandedRepo, fetchReleases]);

  return { repos, loading, releases, loadingReleases, expandedRepo, toggleRepo };
}
