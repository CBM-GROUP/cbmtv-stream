"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { getSavedIds, listSavedItems, listWatchProgress, recordProgress } from "@/services/library";
import { createProgressWriter, progressPayload } from "@/lib/progress-writer";
import type { PartSelector } from "@/lib/viewing";
import type { WatchProgress } from "@/types";

export const progressKey = (user: number | undefined) => ["library", "progress", user] as const;
export const savedIdsKey = (user: number | undefined) => ["library", "saved-ids", user] as const;
export const savedItemsKey = (user: number | undefined) => ["library", "saved", user] as const;

export function useWatchProgress() {
  const { user } = useAuth();
  return useQuery({ queryKey: progressKey(user?.id), queryFn: ({ signal }) => listWatchProgress(signal), enabled: Boolean(user), staleTime: 15000, refetchOnMount: "always", retry: 1 });
}

export function useSavedIds() {
  const { user } = useAuth();
  return useQuery({ queryKey: savedIdsKey(user?.id), queryFn: ({ signal }) => getSavedIds(signal), enabled: Boolean(user), staleTime: 30000, retry: 1 });
}

export function useSavedItems() {
  const { user } = useAuth();
  return useQuery({ queryKey: savedItemsKey(user?.id), queryFn: ({ signal }) => listSavedItems(signal), enabled: Boolean(user), staleTime: 30000, retry: 1 });
}

export function useProgressRecorder(content: number, part: PartSelector | null, enabled: boolean) {
  const { user } = useAuth();
  const owner = user?.id, currentOwner = useRef(owner), recording = useRef(enabled);
  currentOwner.current = owner; recording.current = enabled;
  const client = useQueryClient();
  const writer = useRef<ReturnType<typeof createProgressWriter> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!owner) return;
    let mounted = true;
    setFailed(false);
    const session = createProgressWriter(async (payload) => {
      if (currentOwner.current !== owner) return;
      const saved = await recordProgress(payload);
      client.setQueryData<WatchProgress[]>(progressKey(owner), (items = []) => [saved, ...items.filter((item) => item.content.id !== saved.content.id)]);
      if (mounted) setFailed(false);
    }, () => { if (mounted) setFailed(true); });
    writer.current = session;
    const flush = () => { if (currentOwner.current === owner) session.flush(); };
    const visibility = () => { if (document.hidden) flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted = false; flush(); session.dispose();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
      if (writer.current === session) writer.current = null;
    };
  }, [owner, content, part?.episode, part?.miniseries, client]);

  const sample = useCallback((position: number, duration: number, urgent = false, ended = false) => {
    if (!recording.current || !owner || currentOwner.current !== owner) return;
    const payload = progressPayload(content, part, position, duration, ended);
    if (payload) writer.current?.sample(payload, urgent);
  }, [owner, content, part]);
  const retry = useCallback(() => writer.current?.retry(), []);
  return { sample, failed, retry };
}
