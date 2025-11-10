"use client";

import ChannelCarousel from "@/components/ChannelCarousel";
import { LanderCarousel } from "@/components/LanderCarousel";
import { ProgramGrid } from "@/components/ProgramGrid";
import { useChannels } from "@/hooks/useChannels";
import { useContent } from "@/hooks/useContent";
import { useMovies } from "@/hooks/useMovies";
import { useMemo } from "react";
import { Advert, Program } from "@/types";
import { useAds } from "@/hooks/useAds";

interface Movie {
  thumbnail: string;
  title: string;
  description: string;
}

interface Channel {
  id: string;
  name: string;
  cover_image_url: string;
}

export default function HomePage() {
  const { data: movies, isLoading: moviesLoading } = useMovies();
  const { data: channelsData, isLoading: channelsLoading } = useChannels();
  const { data: content, isLoading: contentLoading } = useContent();
  const { data: adverts, isLoading: advertsLoading } = useAds();

  const landerContent = useMemo(() => {
    if (!adverts) return [];
    return adverts?.data;
  }, [adverts]);

  const programs = useMemo(() => {
    if (!content) return [];
    return content.map((program: Program) => {
      return {
        id: program.id,
        src: program.thumbnail,
        alt: program.title,
        title: program.title,
        slug: `programs/${program.id}`,
        genre: program.content_type,
      }
    });
  }, [content]);

  const filters = useMemo(() => {
    if (!content) return [];
    const genres = content.map((program: Program) => program.content_type);
    return [...new Set(genres)];
  }, [content]);

  const channels = useMemo(() => {
    if (!channelsData) return [];
    return channelsData.data.map((channel: Channel) => {
      return {
        title: channel.name,
        src: channel.cover_image_url,
        href: `channels/${channel.id}`,
      };
    });
  }, [channelsData]);

  if (moviesLoading || channelsLoading || contentLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <LanderCarousel slides={landerContent} />
      <ChannelCarousel channels={channels} />
      <ProgramGrid programs={programs} filters={filters} />
    </>
  );
}
