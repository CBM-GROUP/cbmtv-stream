"use client";

import type { Homepage, Progress } from '@/services/homepage';
import { HomeHero } from './HomeHero';
import { ContentRail } from './ContentRail';
import { ProgramCard } from './ProgramCard';
import { playbackDestination } from '@/lib/auth-return';
import { SponsoredPlacement } from './SponsoredPlacement';

function ContinueWatching({ items }: { items: Progress[] }) {
  if (!items.length) return null;
  return <section className="content-section" aria-label="Continue Watching"><h2 className="section-title mb-3">Continue Watching</h2><div className="content-rail h-scroll" tabIndex={0} aria-label="Continue Watching titles">{items.map((item) => <div className="rail-card" key={item.content.id}><ProgramCard id={item.content.id} title={item.content.title} src={item.content.thumbnail} alt={item.content.title} slug={`programs/${item.content.id}`} href={playbackDestination(item.content.id, { episode: item.episode ?? undefined, miniseries: item.miniseries ?? undefined })} /><progress className="h-1 w-full accent-teal-400" aria-label={`${item.content.title} progress`} value={item.position_seconds} max={Math.max(item.duration_seconds, item.position_seconds, 1)} /></div>)}</div></section>;
}

export function HomeSections({ homepage, authenticated }: { homepage: Homepage; authenticated: boolean }) {
  return <div className="home-catalogue">{homepage.sections.filter((section) => section.enabled).map((section) => {
    if (section.source === 'advertising') return <SponsoredPlacement key={section.id} placement={section.id} context="homepage" />;
    if (section.id === 'featured_hero') return <HomeHero key={section.id} titles={section.items} />;
    if (section.id === 'featured_channels') return null;
    if (section.id === 'continue_watching') return authenticated ? <ContinueWatching key={section.id} items={section.items} /> : null;
    return <ContentRail key={section.id} title={section.label} items={section.items} />;
  })}</div>;
}
