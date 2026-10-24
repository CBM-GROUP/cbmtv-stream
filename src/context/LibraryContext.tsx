"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { describeApiError } from "@/lib/api-errors";
import { publicProgress, withProgress } from "@/lib/library-state";
import { ProgressService } from "@/services/library";
import type { WatchProgress, WatchProgressInput } from "@/types";

type LibraryState<T> = { items: T[]; loading: boolean; loaded: boolean; error: string | null };
type LibraryContextValue = {
  progress: LibraryState<WatchProgress>;
  actionError: string | null;
  saveProgress: (input: WatchProgressInput) => Promise<void>;
  removeProgress: (contentId: number) => Promise<void>;
  reload: () => void;
};

const empty = <T,>(): LibraryState<T> => ({ items: [], loading: false, loaded: false, error: null });
const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibrary must be used within LibraryProvider");
  return value;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<LibraryState<WatchProgress>>(empty);
  const [stateAccount, setStateAccount] = useState<number | null>(null);
  const stateAccountRef = useRef<number | null>(null);
  stateAccountRef.current = stateAccount;
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const accountRef = useRef<number | null>(null);
  const progressTouched = useRef<Set<number>>(new Set());
  const progressWrites = useRef<Map<number, Promise<void>>>(new Map());
  const accountId = user?.id ?? null;
  accountRef.current = accountId;

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setProgress(empty());
    setStateAccount(accountId);
    setActionError(null);
    progressTouched.current = new Set();
    progressWrites.current = new Map();
    if (accountId === null) return;

    setProgress({ items: [], loading: true, loaded: false, error: null });
    void ProgressService.list().then((items) => {
      if (active) setProgress((current) => ({
        items: [
          ...current.items,
          ...publicProgress(items).filter((item) => !progressTouched.current.has(item.content.id)),
        ],
        loading: false, loaded: true, error: null,
      }));
    }).catch((error) => {
      if (active) setProgress({ items: [], loading: false, loaded: true, error: describeApiError(error, "Could not load continue watching.") });
    });
    return () => { active = false; };
  }, [authLoading, accountId, reloadKey]);

  const visibleProgress = stateAccount === accountId ? progress : empty<WatchProgress>();
  const saveProgress = async (input: WatchProgressInput) => {
    if (!user || input.position_seconds < 5) return;
    const accountId = user.id;
    const previous = progressWrites.current.get(input.content) ?? Promise.resolve();
    const request = previous.catch(() => {}).then(async () => {
      if (accountRef.current !== accountId || stateAccountRef.current !== accountId) return;
      try {
        const row = await ProgressService.save(input);
        if (accountRef.current !== accountId) return;
        progressTouched.current.add(input.content);
        setProgress((current) => ({
          ...current,
          items: withProgress(current.items, row),
        }));
      } catch {
        // A failed checkpoint must never interrupt playback.
      }
    });
    progressWrites.current.set(input.content, request);
    await request;
    if (progressWrites.current.get(input.content) === request) progressWrites.current.delete(input.content);
  };

  const removeProgress = async (contentId: number) => {
    if (!user || stateAccount !== user.id) return;
    const accountId = user.id;
    try {
      await ProgressService.remove(contentId);
      if (accountRef.current === accountId) {
        progressTouched.current.add(contentId);
        setProgress((current) => ({ ...current, items: current.items.filter((item) => item.content.id !== contentId) }));
      }
    } catch (error) {
      if (accountRef.current === accountId) setActionError(describeApiError(error, "Could not remove this title."));
    }
  };

  return <LibraryContext.Provider value={{ progress: visibleProgress, actionError: stateAccount === accountId ? actionError : null, saveProgress, removeProgress, reload: () => setReloadKey((value) => value + 1) }}>{children}</LibraryContext.Provider>;
}
