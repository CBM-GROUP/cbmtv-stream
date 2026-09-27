'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Episode, Season } from '@/types';

// Shapes come from @/types (mirrors content/serializers.py). The local Episode
// type declared a `description` the Episode model does not have, so the
// paragraph below it guarded never rendered.
type Props = {
  seasons: Season[];
  episodesBySeason: Record<number, Episode[]>;
  onEpisodeSelect: (episode: Episode) => void;
};

export default function SeasonsAccordion({ seasons, episodesBySeason, onEpisodeSelect }: Props) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {seasons.map((season) => (
        <AccordionItem key={season.id} value={`item-${season.id}`} className="border-white/8">
          <AccordionTrigger>
            {season.title}
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {(episodesBySeason[season.id] || []).map((episode) => (
                <button
                  key={episode.id}
                  type="button"
                  disabled={!episode.streaming_link}
                  className="rounded-lg border border-white/10 p-4 text-left transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onEpisodeSelect(episode)}
                >
                  <h4 className="text-lg font-semibold text-white/80">{episode.title}</h4>
                </button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
