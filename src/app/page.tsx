"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HomeHero } from "@/components/HomeHero";
import { ContentRail } from "@/components/ContentRail";
import { SafeImage } from "@/components/SafeImage";
import { useAds } from "@/hooks/useAds";
import { useChannels } from "@/hooks/useChannels";
import { useHeroSettings } from "@/hooks/useHeroSettings";
import { useFeaturedContent, useHomeCatalogue } from "@/hooks/useHomeCatalogue";
import { CATEGORIES, selectNewReleases } from "@/lib/catalogue";

export default function HomePage() {
  const channelRail = useRef<HTMLDivElement>(null);
  const categories = useHomeCatalogue();
  const featured = useFeaturedContent();
  const { data: adverts } = useAds();
  const { data: settings } = useHeroSettings();
  const { data: channels } = useChannels();
  const items = categories.flatMap((query) => query.data ?? []);
  const releases = selectNewReleases(items);
  const slides = useMemo(() => (adverts ?? [])
    .filter((ad) => ad.show_in_hero !== false && (ad.stream_link || ad.advert_thumbnail))
    .sort((a, b) => (a.hero_order ?? 0) - (b.hero_order ?? 0) || a.id - b.id), [adverts]);
  const loading = categories.some((query) => query.isPending);

  return <>
    <HomeHero slides={slides} featured={featured.data?.[0]} imageDurationSeconds={settings?.image_duration_seconds ?? 20} />
    <div className="home-catalogue">
      {Boolean(channels?.length) && <section className="content-section" aria-label="Channels">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold md:text-2xl">Channels</h2>
          <div className="flex items-center gap-2">
            <Link className="mr-2 text-sm text-teal-300" href="/channels">See all</Link>
            <button type="button" aria-label="Scroll channels left" className="hidden rounded-full bg-white/10 p-2 hover:bg-white/20 md:block" onClick={() => channelRail.current?.scrollBy({ left: -320, behavior: "smooth" })}><ChevronLeft size={18} /></button>
            <button type="button" aria-label="Scroll channels right" className="hidden rounded-full bg-white/10 p-2 hover:bg-white/20 md:block" onClick={() => channelRail.current?.scrollBy({ left: 320, behavior: "smooth" })}><ChevronRight size={18} /></button>
          </div>
        </div>
        <div ref={channelRail} className="channel-rail h-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" aria-label="Channel carousel">{channels?.map((channel) => <Link key={channel.id} href={`/channels/${channel.id}`} className="flex w-32 shrink-0 snap-start flex-col items-center gap-2 rounded-lg bg-white/5 p-3 text-center text-sm hover:bg-white/10 sm:w-36"><SafeImage src={channel.logo_url || channel.cover_image_url} alt="" width={80} height={56} className="h-14 w-20 object-contain" /><span className="line-clamp-2">{channel.name}</span></Link>)}</div>
      </section>}
      <ContentRail title="New Releases" items={releases} loading={loading && !releases.length} />
      {categories.map((query, i) => <ContentRail key={CATEGORIES[i].type} title={CATEGORIES[i].title} items={query.data} loading={query.isPending} error={query.isError} onRetry={() => { void query.refetch(); }} href={`/programs?category=${CATEGORIES[i].type}`} />)}
      {!loading && !items.length && categories.every((query) => !query.isError) && <p className="content-section py-8 text-white/65" role="status">New titles are on the way. Explore our channels.</p>}
    </div>
  </>;
}
