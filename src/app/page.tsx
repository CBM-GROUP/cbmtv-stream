"use client";

import ChannelCarousel from "@/components/ChannelCarousel";
import { LanderCarousel } from "@/components/LanderCarousel";
import Preloader from "@/components/Preloader";
import { ProgramGrid } from "@/components/ProgramGrid";
import { useAds } from "@/hooks/useAds";
import { useChannels } from "@/hooks/useChannels";
import type { Channel, ChannelCardItem, ProgramCardItem } from "@/types";
import { useContent } from "@/hooks/useContent";
import { useMovies } from "@/hooks/useMovies";
import { Program } from "@/types";
import { useMemo } from "react";

export default function HomePage() {
  const { data: movies, isLoading: moviesLoading } = useMovies();
  const { data: channelsData, isLoading: channelsLoading } = useChannels();
  const { data: content, isLoading: contentLoading } = useContent();
  const { data: adverts, isLoading: advertsLoading } = useAds();

  // listAds now normalizes to Advert[]; it used to hand back the raw axios
  // response, which is why this reached into `.data`.
  const landerContent = useMemo(() => adverts ?? [], [adverts]);

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

  if (moviesLoading || channelsLoading || contentLoading) {
    return <Preloader />;
  }

  return (
    <>
      <LanderCarousel slides={landerContent} />
      <ChannelCarousel channels={channels} />
      <ProgramGrid programs={programs} filters={filters} />
    </>
  );
}
