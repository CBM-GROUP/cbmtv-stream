"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SafeImage } from "./SafeImage";
import { Play } from "lucide-react";
import { formatDuration, mediaSource, orderedEpisodes } from "@/lib/viewing";
import type { Episode, Season } from "@/types";

type Props = {
  seasons: Season[];
  episodesBySeason: Record<number, Episode[]>;
  selectedSeason: number;
  currentEpisode?: number;
  playing: boolean;
  loading: boolean;
  error: boolean;
  onSeasonChange: (id: number) => void;
  onEpisodeSelect: (episode: Episode) => void;
  onRetry: () => void;
};

export default function SeasonsAccordion({ seasons, episodesBySeason, selectedSeason, currentEpisode, playing, loading, error, onSeasonChange, onEpisodeSelect, onRetry }: Props) {
  return <Accordion type="single" value={String(selectedSeason)} onValueChange={(value) => { if (value) onSeasonChange(Number(value)); }} className="w-full">
    {seasons.map((season) => <AccordionItem key={season.id} value={String(season.id)} className="border-white/10">
      <AccordionTrigger className="min-h-14 text-left text-base text-white"><span>Season {season.season_number}{season.title && !/^season\s+\d+$/i.test(season.title.trim()) ? ` — ${season.title}` : ""}</span></AccordionTrigger>
      <AccordionContent>
        {season.description?.trim() && <p className="mb-4 max-w-3xl text-sm leading-6 text-white/65">{season.description}</p>}
        {loading ? <p className="py-4 text-sm text-white/65" role="status">Loading episodes…</p> : error ? <div className="py-4 text-sm" role="alert"><p>Episodes couldn&apos;t be loaded.</p><button className="detail-secondary-action mt-3" onClick={onRetry}>Try again</button></div> : !(episodesBySeason[season.id]?.length) ? <p className="py-4 text-sm text-white/60" role="status">No episodes are available in this season yet.</p> : <div className="episode-grid">{orderedEpisodes(episodesBySeason[season.id] ?? []).map((episode) => {
          const selected = episode.id === currentEpisode, available = Boolean(mediaSource(episode.streaming_link));
          return <button key={episode.id} type="button" aria-pressed={selected} disabled={!available} onClick={() => onEpisodeSelect(episode)} className="episode-card" data-selected={selected}>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black/40"><SafeImage src={episode.thumbnail} alt="" fill className="object-contain" sizes="(min-width: 1024px) 22vw, (min-width: 640px) 44vw, 90vw" /><Play size={28} className="absolute bottom-2 right-2 rounded-full bg-black/65 p-1.5 text-white" aria-hidden="true" /></div>
            <div className="p-3"><p className="text-xs text-teal-300">Episode {episode.episode_number}{selected ? playing ? " · Now playing" : " · Selected" : ""}</p><h3 className="mt-1 text-sm font-semibold leading-5 text-white">{episode.title}</h3>{episode.duration && <p className="mt-2 text-xs text-white/60">{formatDuration(episode.duration)}</p>}{!available && <p className="mt-2 text-xs text-white/50">Not available</p>}</div>
          </button>;
        })}</div>}
      </AccordionContent>
    </AccordionItem>)}
  </Accordion>;
}
