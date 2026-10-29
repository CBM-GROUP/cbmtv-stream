"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HomeHero } from "@/components/HomeHero";
import { ContentRail } from "@/components/ContentRail";
import { SafeImage } from "@/components/SafeImage";
import { ContinueWatchingRail } from "@/components/ContinueWatchingRail";
import { useAds } from "@/hooks/useAds";
import { useChannels } from "@/hooks/useChannels";
import { useHeroSettings } from "@/hooks/useHeroSettings";
import { useFeaturedContent, useHomeCatalogue } from "@/hooks/useHomeCatalogue";
import { HOME_CATEGORIES, selectNewReleases } from "@/lib/catalogue";

export default function HomePage() {
  const channelRail = useRef<HTMLDivElement>(null);
  const categories = useHomeCatalogue();
  const featured = useFeaturedContent();
  const { data: adverts, isPending: advertsLoading } = useAds();
  const { data: settings } = useHeroSettings();
  const { data: channels, isPending: channelsLoading, isError: channelsError, refetch: refetchChannels } = useChannels();
  const items = categories.flatMap((query) => query.data ?? []);
  const releases = selectNewReleases(items);
  const slides = useMemo(() => (adverts ?? [])
    .filter((ad) => ad.show_in_hero !== false && (ad.stream_link || ad.advert_thumbnail))
    .sort((a, b) => (a.hero_order ?? 0) - (b.hero_order ?? 0) || a.id - b.id), [adverts]);
  const loading = categories.some((query) => query.isPending);

  return <>
    <HomeHero slides={slides} featured={featured.data?.[0]} loading={featured.isPending || advertsLoading} imageDurationSeconds={settings?.image_duration_seconds ?? 20} />
    <div className="home-catalogue">
      <ContinueWatchingRail />
      {(channelsLoading || channelsError || Boolean(channels?.length)) && <section className="content-section" aria-label="Featured Channels">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="section-title">Featured Channels</h2>
          <button type="button" aria-label="Scroll channels right" className="rail-arrow" onClick={() => {
            const track = channelRail.current;
            if (track) track.scrollTo({ left: track.scrollLeft >= track.scrollWidth - track.clientWidth - 2 ? 0 : track.scrollLeft + track.clientWidth, behavior: "smooth" });
          }}><ChevronRight size={18} /></button>
        </div>
        {channelsError ? <div className="flex items-center gap-4 py-5 text-sm text-white/65" role="alert"><p>Couldn&apos;t load channels.</p><button onClick={() => { void refetchChannels(); }} className="min-h-11 text-teal-300 underline">Try again</button></div> :
        <div ref={channelRail} className="channel-rail h-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4" tabIndex={0} aria-busy={channelsLoading} aria-label="Channel carousel">{channelsLoading ? Array.from({ length: 8 }, (_, i) => <div key={i} className="channel-card shrink-0 rounded-xl bg-white/5 p-2" aria-hidden="true"><div className="aspect-square animate-pulse rounded-lg bg-white/10" /><div className="mt-2 h-10 rounded bg-white/5" /></div>) : channels?.map((channel) => <Link key={channel.id} href={`/channels/${channel.id}`} className="channel-card flex shrink-0 snap-start flex-col gap-2 rounded-xl bg-white/5 p-2 text-center text-sm hover:bg-white/10">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg"><SafeImage src={channel.cover_image_url || channel.logo_url} alt="" fill className="object-contain" sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 29vw, 42vw" /></div>
          <span className="line-clamp-2 min-h-10 content-center font-medium">{channel.name}</span>
        </Link>)}</div>}
      </section>}
      <div className="new-releases"><ContentRail title="New Releases" items={releases} loading={loading && !releases.length} error={categories.every((query) => query.isError)} onRetry={() => { categories.forEach((query) => { void query.refetch(); }); }} />{Boolean(releases.length) && <p className="content-section -mt-4 text-xs text-white/45">Recently added to CBM TV.</p>}</div>
      {categories.map((query, i) => <ContentRail key={HOME_CATEGORIES[i].type} title={HOME_CATEGORIES[i].title} items={query.data} loading={query.isPending} error={query.isError} onRetry={() => { void query.refetch(); }} />)}
      {!loading && !items.length && categories.every((query) => !query.isError) && <p className="content-section py-8 text-white/65" role="status">New titles are on the way. Explore our channels.</p>}
    </div>
  </>;
}
