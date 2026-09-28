"use client";

import ChannelCarousel from "@/components/ChannelCarousel";
import { HomeHero } from "@/components/HomeHero";
import Preloader from "@/components/Preloader";
import { ProgramGrid } from "@/components/ProgramGrid";
import { useAds } from "@/hooks/useAds";
import { useChannels } from "@/hooks/useChannels";
import type { Channel, ChannelCardItem, ProgramCardItem } from "@/types";
import { useContent } from "@/hooks/useContent";
import { useMovies } from "@/hooks/useMovies";
import { useHeroSettings } from "@/hooks/useHeroSettings";
import { Program } from "@/types";
import { useMemo } from "react";

export default function HomePage() {
  const { isLoading: moviesLoading } = useMovies();
  const { data: channelsData, isLoading: channelsLoading } = useChannels();
  const { data: content, isLoading: contentLoading } = useContent();
  const { data: adverts, isLoading: advertsLoading } = useAds();
  const { data: heroSettings } = useHeroSettings();

  // listAds now normalizes to Advert[]; it used to hand back the raw axios
  // response, which is why this reached into `.data`.
  const landerContent = useMemo(() => (adverts ?? [])
    .filter((advert) => advert.show_in_hero !== false && (advert.stream_link || advert.advert_thumbnail))
    .sort((a, b) => (a.hero_order ?? 0) - (b.hero_order ?? 0) || a.id - b.id), [adverts]);

  const programs = useMemo(() => {
    if (!content) return [];
    return content.map(
      (program: Program): ProgramCardItem => ({
        id: program.id,
        src: program.thumbnail,
        alt: program.title,
        title: program.title,
        slug: `programs/${program.id}`,
        genre: program.content_type,
      }),
    );
  }, [content]);

  const filters = useMemo(() => {
    if (!content) return [];
    const genres = content.map((program: Program) => program.content_type);
    return [...new Set(genres)];
  }, [content]);

  const channels = useMemo(() => {
    if (!channelsData) return [];
    // cover_image_url is null until an editor uploads one; the carousel
    // requires a string src, so drop channels that have no cover.
    return channelsData
      .filter((channel: Channel) => Boolean(channel.cover_image_url))
      .map(
        (channel: Channel): ChannelCardItem => ({
          title: channel.name,
          src: channel.cover_image_url as string,
          href: `channels/${channel.id}`,
        }),
      );
  }, [channelsData]);

  if (moviesLoading || channelsLoading || contentLoading || advertsLoading) {
    return <Preloader />;
  }

  return (
    <>
      <HomeHero slides={landerContent} imageDurationSeconds={heroSettings?.image_duration_seconds ?? 20} />
      <ChannelCarousel channels={channels} />
      <ProgramGrid programs={programs} filters={filters} />
    </>
  );
}
