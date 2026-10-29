"use client";

import { useRef } from "react";
import { ChevronRight, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useWatchProgress, progressKey } from "@/hooks/useLibrary";
import { removeWatchProgress } from "@/services/library";
import { unfinishedProgress, formatTime } from "@/lib/viewing";
import { playbackDestination } from "@/lib/auth-return";
import { ProgramCard } from "./ProgramCard";
import type { WatchProgress } from "@/types";

export function ContinueWatchingRail({ showEmpty = false }: { showEmpty?: boolean }) {
  const { user } = useAuth(), query = useWatchProgress(), client = useQueryClient();
  const track = useRef<HTMLDivElement>(null), lock = useRef(false);
  const mutation = useMutation({ mutationFn: (action: { content: number; owner: number }) => removeWatchProgress(action.content), onSuccess: (_, action) => client.setQueryData<WatchProgress[]>(progressKey(action.owner), (items = []) => items.filter((item) => item.content.id !== action.content)) });
  const items = unfinishedProgress(query.data ?? []);
  if (!user) return null;
  if (!items.length) {
    if (!showEmpty) return null;
    return <div className="content-section py-5" role={query.isError ? "alert" : "status"}>{query.isPending ? "Loading your viewing history…" : query.isError ? <><p>Your viewing history couldn&apos;t be loaded.</p><button className="detail-secondary-action mt-4" onClick={() => { void query.refetch(); }}>Try again</button></> : "You have no unfinished titles. Explore our channels to find your next story."}</div>;
  }
  return <section className="content-section" aria-labelledby="continue-watching-title"><div className="mb-3 flex min-h-11 items-center justify-between gap-3"><h2 id="continue-watching-title" className="section-title">Continue Watching</h2><button className="rail-arrow" aria-label="Scroll Continue Watching right" onClick={() => { const rail = track.current; if (rail) rail.scrollTo({ left: rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2 ? 0 : rail.scrollLeft + rail.clientWidth * .8, behavior: "smooth" }); }}><ChevronRight size={18} /></button></div>
    <div ref={track} className="content-rail h-scroll" tabIndex={0} aria-label="Unfinished titles">{items.map((item) => <div className="rail-card relative" key={item.content.id}><ProgramCard id={item.content.id} title={item.content.title} src={item.content.thumbnail} alt={item.content.title} slug={`programs/${item.content.id}`} href={playbackDestination(item.content.id, { episode: item.episode ?? undefined, miniseries: item.miniseries ?? undefined })} /><button className="library-remove" aria-label={`Remove ${item.content.title} from Continue Watching`} disabled={mutation.isPending} onClick={async () => { if (lock.current) return; lock.current = true; try { await mutation.mutateAsync({ content: item.content.id, owner: user.id }); } catch { /* Keep the card and show the error below. */ } finally { lock.current = false; } }}><X size={17} /></button>{item.duration_seconds > 0 && <div className="mt-1 h-1 overflow-hidden rounded bg-white/10" aria-label="Viewing progress"><div className="h-full bg-teal-400" style={{ width: `${Math.min(100, item.position_seconds / item.duration_seconds * 100)}%` }} /></div>}<p className="mt-2 text-xs text-white/60">Resume at {formatTime(item.position_seconds)}</p></div>)}</div>
    {mutation.isError && <p role="alert" className="mt-3 text-sm text-white/65">This title couldn&apos;t be removed. Try again.</p>}
  </section>;
}
