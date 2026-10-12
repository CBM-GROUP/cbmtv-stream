"use client";

import Link from "next/link";
import { Play, RotateCw, X } from "lucide-react";
import { ProgramCard } from "@/components/ProgramCard";
import { SafeImage } from "@/components/SafeImage";
import { useAuth } from "@/context/AuthContext";
import { useLibrary } from "@/context/LibraryContext";

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const { saved, progress, actionError, removeProgress, reload } = useLibrary();

  if (authLoading) return <div className="mx-auto min-h-[60vh] max-w-7xl px-4 py-12 sm:px-12" role="status">Loading your library…</div>;
  if (!user) return (
    <div className="mx-auto min-h-[60vh] max-w-7xl px-4 py-12 sm:px-12">
      <h1 className="text-3xl font-bold">Saved Content</h1>
      <p className="mt-4 text-white/70">Sign in to see your saved titles and continue watching across devices.</p>
    </div>
  );

  return (
    <div className="mx-auto min-h-[60vh] max-w-7xl px-4 py-10 sm:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Saved Content</h1><p className="mt-2 text-white/60">Your titles and playback, synced to your account.</p></div>
        <button type="button" onClick={reload} className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"><RotateCw size={16} /> Refresh</button>
      </div>
      {actionError && <p role="alert" className="mt-5 rounded-lg border border-red-400/40 p-3 text-red-200">{actionError}</p>}

      <section className="mt-12" aria-labelledby="continue-title">
        <h2 id="continue-title" className="text-2xl font-semibold">Continue Watching</h2>
        {!progress.loaded || progress.loading ? <p role="status" className="mt-5 text-white/60">Loading your progress…</p>
          : progress.error ? <p role="alert" className="mt-5 text-red-200">{progress.error}</p>
          : progress.items.length === 0 ? <p className="mt-5 text-white/60">Nothing in progress yet. Start watching a title to see it here.</p>
          : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {progress.items.map((row) => {
              const percent = row.duration_seconds > 0 ? Math.min(100, Math.round(100 * row.position_seconds / row.duration_seconds)) : 0;
              return <article key={row.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <div className="relative aspect-video"><SafeImage src={row.content.thumbnail} alt={row.content.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" /></div>
                <div className="p-4">
                  <h3 className="truncate font-semibold">{row.content.title}</h3>
                  <p className="mt-1 text-sm text-white/60">{Math.floor(row.position_seconds / 60)} min watched{row.duration_seconds > 0 ? ` · ${Math.max(0, Math.ceil((row.duration_seconds - row.position_seconds) / 60))} min left` : ""}</p>
                  <div className="mt-3 h-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-teal-400" style={{ width: `${percent}%` }} /></div>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/programs/${row.content.id}?resume=1`} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-black hover:bg-teal-400"><Play size={16} /> Resume</Link>
                    <button type="button" onClick={() => void removeProgress(row.content.id)} aria-label={`Remove ${row.content.title} from Continue Watching`} className="rounded-lg border border-white/20 px-3 hover:bg-white/10"><X size={18} /></button>
                  </div>
                </div>
              </article>;
            })}
          </div>}
      </section>

      <section className="mt-14" aria-labelledby="saved-title">
        <h2 id="saved-title" className="text-2xl font-semibold">Saved titles</h2>
        {!saved.loaded || saved.loading ? <p role="status" className="mt-5 text-white/60">Loading saved titles…</p>
          : saved.error ? <p role="alert" className="mt-5 text-red-200">{saved.error}</p>
          : saved.items.length === 0 ? <p className="mt-5 text-white/60">No saved titles yet. Use the heart on a title to add it here.</p>
          : <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {saved.items.map((item) => <ProgramCard key={item.id} id={item.content.id} title={item.content.title} src={item.content.thumbnail} alt={item.content.title} slug={`programs/${item.content.id}`} href={`/programs/${item.content.id}`} />)}
          </div>}
      </section>
    </div>
  );
}
