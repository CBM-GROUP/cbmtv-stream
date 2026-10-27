"use client";

import { useMemo } from "react";
import Link from "next/link";
import { HomeHero } from "@/components/HomeHero";
import { ContentRail } from "@/components/ContentRail";
import { SafeImage } from "@/components/SafeImage";
import { useAds } from "@/hooks/useAds";
import { useChannels } from "@/hooks/useChannels";
import { useHeroSettings } from "@/hooks/useHeroSettings";
import { useFeaturedContent, useHomeCatalogue } from "@/hooks/useHomeCatalogue";
import { CATEGORIES, selectNewReleases } from "@/lib/catalogue";

export default function HomePage() {
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
      <ContentRail title="New Releases" items={releases} loading={loading && !releases.length} />
      {categories.map((query, i) => <ContentRail key={CATEGORIES[i].type} title={CATEGORIES[i].title} items={query.data} loading={query.isPending} error={query.isError} onRetry={() => { void query.refetch(); }} href={`/programs?category=${CATEGORIES[i].type}`} />)}
      {!loading && !items.length && categories.every((query) => !query.isError) && <p className="content-section py-8 text-white/65" role="status">New titles are on the way. Explore our channels below.</p>}
      {Boolean(channels?.length) && <section className="content-section" aria-label="Channels">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold md:text-2xl">Channels</h2><Link className="text-sm text-teal-300" href="/channels">See all</Link></div>
        <div className="h-scroll flex gap-3 pb-2">{channels?.map((channel) => <Link key={channel.id} href={`/channels/${channel.id}`} className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-lg bg-white/5 p-4 text-center text-sm hover:bg-white/10"><SafeImage src={channel.logo_url || channel.cover_image_url} alt="" width={80} height={64} className="h-16 w-20 object-contain" />{channel.name}</Link>)}</div>
      </section>}
    </div>
  </>;
}
