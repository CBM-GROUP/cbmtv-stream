"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { describeApiError } from "@/lib/api-errors";
import { publicProgress, publicSaved, withProgress, withSaved, withoutSaved } from "@/lib/library-state";
import { ProgressService, SavedService } from "@/services/library";
import type { SavedItem, WatchProgress, WatchProgressInput } from "@/types";

type LibraryState<T> = { items: T[]; loading: boolean; loaded: boolean; error: string | null };
type SaveResult = "saved" | "removed" | "auth-required" | "failed";

type LibraryContextValue = {
  saved: LibraryState<SavedItem>;
  progress: LibraryState<WatchProgress>;
  savedIds: Set<number>;
  pending: Set<number>;
  actionError: string | null;
  toggleSaved: (contentId: number) => Promise<SaveResult>;
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
  const [saved, setSaved] = useState<LibraryState<SavedItem>>(empty);
  const [progress, setProgress] = useState<LibraryState<WatchProgress>>(empty);
  const [pending, setPending] = useState<Set<number>>(new Set());
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
    setSaved(empty());
    setProgress(empty());
    setPending(new Set());
    setStateAccount(accountId);
    setActionError(null);
    progressTouched.current = new Set();
    progressWrites.current = new Map();
    if (accountId === null) return;

    setSaved({ items: [], loading: true, loaded: false, error: null });
    setProgress({ items: [], loading: true, loaded: false, error: null });
    void SavedService.list().then((items) => {
      if (active) setSaved({ items: publicSaved(items), loading: false, loaded: true, error: null });
    }).catch((error) => {
      if (active) setSaved({ items: [], loading: false, loaded: true, error: describeApiError(error, "Could not load saved titles.") });
    });
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

  const visibleSaved = stateAccount === accountId ? saved : empty<SavedItem>();
  const visibleProgress = stateAccount === accountId ? progress : empty<WatchProgress>();
  const visiblePending = stateAccount === accountId ? pending : new Set<number>();
  const savedIds = new Set(visibleSaved.items.map((item) => item.content.id));
  const toggleSaved = async (contentId: number): Promise<SaveResult> => {
    if (!user) return "auth-required";
    if (stateAccount !== user.id || !saved.loaded || saved.loading || pending.has(contentId)) return "failed";
    const accountId = user.id;
    const wasSaved = savedIds.has(contentId);
    setPending((current) => new Set(current).add(contentId));
    setActionError(null);
    try {
      if (wasSaved) {
        await SavedService.remove(contentId);
        if (accountRef.current === accountId) setSaved((current) => ({ ...current, items: withoutSaved(current.items, contentId) }));
      } else {
        const item = await SavedService.add(contentId);
        if (accountRef.current === accountId) setSaved((current) => ({ ...current, items: withSaved(current.items, item) }));
      }
      return wasSaved ? "removed" : "saved";
    } catch (error) {
      if (accountRef.current === accountId) setActionError(describeApiError(error, "Could not update saved titles."));
      return "failed";
    } finally {
      if (accountRef.current === accountId) setPending((current) => {
        const next = new Set(current);
        next.delete(contentId);
        return next;
      });
    }
  };

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

  return <LibraryContext.Provider value={{ saved: visibleSaved, progress: visibleProgress, savedIds, pending: visiblePending, actionError: stateAccount === accountId ? actionError : null, toggleSaved, saveProgress, removeProgress, reload: () => setReloadKey((value) => value + 1) }}>{children}</LibraryContext.Provider>;
}
