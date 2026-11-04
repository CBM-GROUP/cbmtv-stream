"use client";

import { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Homepage, Progress } from '@/services/homepage';
import type { Channel } from '@/types';
import { HomeHero } from './HomeHero';
import { ContentRail } from './ContentRail';
import { ProgramCard } from './ProgramCard';
import ChannelCard from './ChannelCard';
import { playbackDestination } from '@/lib/auth-return';

function FeaturedChannels({ channels }: { channels: Channel[] }) {
  const rail = useRef<HTMLDivElement>(null);
  if (!channels.length) return null;
  return <section className="content-section" aria-label="Featured Channels"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="section-title">Featured Channels</h2><button type="button" aria-label="Scroll channels right" className="rail-arrow" onClick={() => {
    const track = rail.current;
    if (track) track.scrollTo({ left: track.scrollLeft >= track.scrollWidth - track.clientWidth - 2 ? 0 : track.scrollLeft + track.clientWidth, behavior: 'smooth' });
  }}><ChevronRight size={18} /></button></div>
    <div ref={rail} className="channel-rail h-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4" tabIndex={0} aria-label="Channel carousel">{channels.map((channel) => <div key={channel.id} className="channel-card shrink-0 snap-start"><ChannelCard id={String(channel.id)} title={channel.name} image={channel.cover_image_url || channel.logo_url || ''} /></div>)}</div>
  </section>;
}

function ContinueWatching({ items }: { items: Progress[] }) {
  if (!items.length) return null;
  return <section className="content-section" aria-label="Continue Watching"><h2 className="section-title mb-3">Continue Watching</h2><div className="content-rail h-scroll" tabIndex={0} aria-label="Continue Watching titles">{items.map((item) => <div className="rail-card" key={item.content.id}><ProgramCard id={item.content.id} title={item.content.title} src={item.content.thumbnail} alt={item.content.title} slug={`programs/${item.content.id}`} href={playbackDestination(item.content.id, { episode: item.episode ?? undefined, miniseries: item.miniseries ?? undefined })} /><progress className="h-1 w-full accent-teal-400" aria-label={`${item.content.title} progress`} value={item.position_seconds} max={Math.max(item.duration_seconds, item.position_seconds, 1)} /></div>)}</div></section>;
}

export function HomeSections({ homepage, authenticated }: { homepage: Homepage; authenticated: boolean }) {
  return <div className="home-catalogue">{homepage.sections.filter((section) => section.enabled).map((section) => {
    if (section.id === 'featured_hero') return <HomeHero key={section.id} titles={section.items} />;
    if (section.id === 'featured_channels') return <FeaturedChannels key={section.id} channels={section.items} />;
    if (section.id === 'continue_watching') return authenticated ? <ContinueWatching key={section.id} items={section.items} /> : null;
    return <ContentRail key={section.id} title={section.label} items={section.items} />;
  })}</div>;
}
