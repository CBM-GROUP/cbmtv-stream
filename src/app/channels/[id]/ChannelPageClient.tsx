"use client";
import { ProgramGrid } from '@/components/ProgramGrid';
import { SafeImage } from "@/components/SafeImage";
import { useContent } from '@/hooks/useContent';
import { Program } from '@/types';
import { useMemo } from 'react';

interface Channel {
  id: string;
  name: string;
  description: string;
  cover_image_url: string;
}

interface ChannelProgramItem {
  id: string;
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  slug: string;
  genre?: string;
  content_type?: string;
}

type Props = {
  channel: Channel;
};

export default function ChannelPageClient({ channel }: Props) {
  const { data: content, isLoading: contentLoading } = useContent();

  // Derive programs for this channel only
  const channelPrograms = useMemo(() => {
    if (!content || !channel?.id) return [];
    return content
      .filter((program: Program) => program.channel === channel.id)
      .map((program: Program) => ({
        id: program.id,
        src: program.thumbnail,
        alt: program.title,
        title: program.title,
        width: 400,
        height: 400,
        slug: `programs/${program.id}`,
        genre: program.genre,
        content_type: program.content_type,
      }));
  }, [content, channel?.id]);

  const filters = useMemo(() => {
    if (!channelPrograms) return [];
    const allGenres: string[] = channelPrograms.flatMap((program: ChannelProgramItem) =>
      program.content_type ? program.content_type.split(',').map(g => g.trim()) : []
    );
    const uniqueGenres = [...new Set(allGenres)];
    return uniqueGenres.filter(g => g.length > 0);
  }, [channelPrograms]);

  if (!channel) {
    return <div>Loading channel...</div>;
  }

  if (contentLoading) {
    return <div>Loading content...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center">
        <SafeImage
          src={channel.cover_image_url}
          alt={channel.name}
          width={300}
          height={300}
          className="rounded-lg w-32 h-32"
        />
        <div className="md:w-2/3 mt-4 md:mt-0 text-center flex justify-center items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold">{channel.name}</h1>
          </div>
          <p className="text-gray-400 mt-2">{channel.description}</p>
        </div>
      </div>

      <section className="mt-8">
        <ProgramGrid programs={channelPrograms} filters={filters} />
      </section>
    </div>
  );
}