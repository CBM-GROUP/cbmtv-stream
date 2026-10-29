"use client";

import { useId, useRef } from "react";
import { ChevronRight } from "lucide-react";
import type { Program } from "@/types";
import { ProgramCard } from "./ProgramCard";

export function ContentRail({ title, items = [], loading = false, error = false, onRetry }: {
  title: string; items?: Program[]; loading?: boolean; error?: boolean; onRetry?: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  if (!loading && !error && !items.length) return null;
  return <section className="content-section" aria-labelledby={id}>
    <div className="mb-3 flex min-h-11 items-center justify-between gap-4">
      <h2 id={id} className="section-title">{title}</h2>
      {!loading && !error && <button type="button" className="rail-arrow" aria-label={`Scroll ${title} right`} onClick={() => {
        const rail = track.current;
        if (rail) rail.scrollTo({ left: rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2 ? 0 : rail.scrollLeft + rail.clientWidth * .8, behavior: "smooth" });
      }}><ChevronRight size={18} /></button>}
    </div>
    {error ? <div className="flex items-center gap-4 py-5 text-sm text-white/65" role="alert"><p>Couldn&apos;t load {title.toLowerCase()}.</p><button onClick={onRetry} className="text-teal-300 underline">Try again</button></div> :
      <div ref={track} className="content-rail h-scroll" tabIndex={0} aria-label={`${title} titles`} aria-busy={loading}>
        {loading ? Array.from({ length: 6 }, (_, i) => <div key={i} className="rail-card" aria-hidden="true"><div className="aspect-2/3 animate-pulse rounded-lg bg-white/10" /><div className="mt-2 h-10 rounded bg-white/5" /></div>) : items.map((item) => <div className="rail-card" key={item.id}><ProgramCard id={item.id} title={item.title} src={item.thumbnail} alt={item.title} slug={`programs/${item.id}`} href={`/programs/${item.id}`} /></div>)}
      </div>}
  </section>;
}
