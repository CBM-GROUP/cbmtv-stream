"use client";

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Homepage, Progress } from '@/services/homepage';
import type { Channel } from '@/types';
import { HomeHero } from './HomeHero';
import { ContentRail } from './ContentRail';
import { ProgramCard } from './ProgramCard';
import { SafeImage } from './SafeImage';
import Link from 'next/link';
import { playbackDestination } from '@/lib/auth-return';
import { SponsoredPlacement } from './SponsoredPlacement';
import { useHeroSettings } from '@/hooks/useHeroSettings';

function Channels({ channels }: { channels: Channel[] }) {
  const rail = useRef<HTMLDivElement>(null);
  if (!channels.length) return null;
  return <section className="content-section" aria-label="Channels"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="section-title">Channels</h2><div className="flex items-center gap-2"><Link className="mr-2 text-sm text-teal-300" href="/channels">See all</Link><button type="button" aria-label="Scroll channels left" className="hidden rounded-full bg-white/10 p-2 hover:bg-white/20 md:block" onClick={() => rail.current?.scrollBy({ left: -320, behavior: 'smooth' })}><ChevronLeft size={18} /></button><button type="button" aria-label="Scroll channels right" className="rail-arrow" onClick={() => {
    const track = rail.current;
    if (track) track.scrollTo({ left: track.scrollLeft >= track.scrollWidth - track.clientWidth - 2 ? 0 : track.scrollLeft + track.clientWidth, behavior: 'smooth' });
  }}><ChevronRight size={18} /></button></div></div>
    <div ref={rail} className="channel-rail h-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4" tabIndex={0} aria-label="Channel carousel">{channels.map((channel) => <Link key={channel.id} href={`/channels/${channel.id}`} className="channel-card flex shrink-0 snap-start flex-col gap-2 rounded-xl bg-white/5 p-2 text-center text-sm hover:bg-white/10"><div className="relative aspect-square w-full overflow-hidden rounded-lg"><SafeImage src={channel.cover_image_url || channel.logo_url} alt="" fill className="object-contain" sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 29vw, 42vw" /></div><span className="line-clamp-2 min-h-10 content-center font-medium">{channel.name}</span></Link>)}</div>
  </section>;
}

function ContinueWatching({ items }: { items: Progress[] }) {
  if (!items.length) return null;
  return <section className="content-section" aria-label="Continue Watching"><h2 className="section-title mb-3">Continue Watching</h2><div className="content-rail h-scroll" tabIndex={0} aria-label="Continue Watching titles">{items.map((item) => <div className="rail-card" key={item.content.id}><ProgramCard id={item.content.id} title={item.content.title} src={item.content.thumbnail} alt={item.content.title} slug={`programs/${item.content.id}`} href={playbackDestination(item.content.id, { episode: item.episode ?? undefined, miniseries: item.miniseries ?? undefined })} /><progress className="h-1 w-full accent-teal-400" aria-label={`${item.content.title} progress`} value={item.position_seconds} max={Math.max(item.duration_seconds, item.position_seconds, 1)} /></div>)}</div></section>;
}

export function HomeSections({ homepage, authenticated }: { homepage: Homepage; authenticated: boolean }) {
  const { data: heroSettings } = useHeroSettings();
  return <div className="home-catalogue">{homepage.sections.filter((section) => section.enabled).map((section) => {
    if (section.source === 'advertising') return <SponsoredPlacement key={section.id} placement={section.id} context="homepage" />;
    if (section.id === 'featured_hero') return <HomeHero key={section.id} titles={section.items} settings={heroSettings} />;
    if (section.id === 'featured_channels') return <Channels key={section.id} channels={section.items} />;
    if (section.id === 'continue_watching') return authenticated ? <ContinueWatching key={section.id} items={section.items} /> : null;
    return <ContentRail key={section.id} title={section.label} items={section.items} />;
  })}</div>;
}
