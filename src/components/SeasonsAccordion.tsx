'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { getSeasonEpisodes } from '@/services/series';
import type { Episode, Season } from '@/types';
import { useState } from 'react';

// Shapes come from @/types (mirrors content/serializers.py). The local Episode
// type declared a `description` the Episode model does not have, so the
// paragraph below it guarded never rendered.
type Props = {
  seasons: Season[];
  onEpisodeSelect: (url: string | null) => void;
};

export default function SeasonsAccordion({ seasons, onEpisodeSelect }: Props) {
  const [episodesBySeason, setEpisodesBySeason] = useState<{ [key: number]: Episode[] }>({});

  const handleSeasonToggle = (seasonId: number) => {
    if (!episodesBySeason[seasonId]) {
      getSeasonEpisodes(seasonId).then((episodes) => {
        setEpisodesBySeason((prev) => ({ ...prev, [seasonId]: episodes }));
      });
    }
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      {seasons.map((season) => (
        <AccordionItem key={season.id} value={`item-${season.id}`} className="border-white/8">
          <AccordionTrigger onClick={() => handleSeasonToggle(season.id)}>
            {season.title}
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {(episodesBySeason[season.id] || []).map((episode) => (
                <div
                  key={episode.id}
                  className="border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => onEpisodeSelect(episode.streaming_link)}
                >
                  <h4 className="text-lg font-semibold text-white/80">{episode.title}</h4>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}