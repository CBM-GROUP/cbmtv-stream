"use client";

import SeasonsAccordion from "@/components/SeasonsAccordion";
import { SafeImage } from "@/components/SafeImage";
import { Button } from "@/components/ui/button";
import { useContent } from "@/hooks/useContent";
import { getSeriesSeasons } from "@/services/series";
import type { Program, Season } from "@/types";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProgramCard } from "./ProgramCard";

type Props = {
  program: Program;
};

function getUrlType(url: string): "youtube" | "direct" | null {
  if (!url) return null;
  try {
    const urlObject = new URL(url);
    if (
      urlObject.hostname.includes("youtube.com") ||
      urlObject.hostname.includes("youtu.be")
    ) {
      return "youtube";
    }
    return urlObject.protocol === "http:" || urlObject.protocol === "https:"
      ? "direct"
      : null;
  } catch (error) {
    console.error("Error getting URL type:", error);
    return null;
  }
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const urlObject = new URL(url);
    if (urlObject.hostname.includes("youtube.com")) {
      return urlObject.searchParams.get("v");
    }
    if (urlObject.hostname.includes("youtu.be")) {
      return urlObject.pathname.substring(1);
    }
    return null;
  } catch (error) {
    console.error("Error getting YouTube video ID:", error);
    return null;
  }
}

export default function ProgramDetail({ program }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  // Content.trailer_link and .streaming_link are both nullable on the API.
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const videoPlayerRef = useRef<HTMLDivElement>(null);
  const [playbackType, setPlayBackType] = useState<"streaming" | "ad" | null>(
    "ad"
  );

  const { data: channelContent, isLoading: contentLoading } = useContent();

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(
      () => {
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000); // Reset after 2 seconds
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  useEffect(() => {
    console.log(program);
    if (program.content_type === "series") {
      getSeriesSeasons(program.id).then(setSeasons);
    }
  }, [program]);

  useEffect(() => {
    if (program.trailer_link) {
      setCurrentVideoUrl(program.trailer_link);
      setPlayBackType("ad");
    } else {
      setCurrentVideoUrl(program.streaming_link ?? null);
      setPlayBackType("streaming");
    }
  }, [program]);

  useEffect(() => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [currentVideoUrl]);

  const urlType = currentVideoUrl ? getUrlType(currentVideoUrl) : null;
  const youtubeId =
    urlType === "youtube" && currentVideoUrl
      ? getYouTubeVideoId(currentVideoUrl)
      : null;

  const channelPrograms = useMemo(() => {
    if (!channelContent || !program?.channel) return [];
    return channelContent.filter(
      (p) => p.channel === program.channel && p.id !== program.id
    );
  }, [channelContent, program?.channel]);

  const playNext = () => {
    if (channelPrograms.length > 0) {
      const nextProgram = channelPrograms[0];
      program = nextProgram;
      setCurrentVideoUrl(nextProgram.streaming_link ?? null);
      setPlayBackType("streaming");
    }
  };

  useEffect(() => {
    console.log("Similar Programs", channelPrograms);
  }, [channelPrograms]);

  return (
    <>
      {/*
        Outer band is full-width and sticky so the player follows the reader,
        offset by --header-h so it parks *beneath* the NavBar rather than on top
        of it. Its z-index is deliberately below the header's (see the stacking
        tokens in globals.css); this used to be `z-100` against the header's
        `z-50` and covered the navigation on every program page.

        The inner .player-frame carries the single shared sizing rule: strict
        16:9, centred, capped so it stays cinematic without swallowing a large
        monitor. The class it replaces here, `aspect-16:9`, was not a real
        Tailwind utility -- the colon parses as a variant separator, so it
        generated no CSS at all and the container had no aspect ratio. The
        <video> inside then resolved `h-full` against an auto-height parent and
        rendered at full viewport width times its intrinsic ratio, which is why
        the player ballooned on large screens.
      */}
      <div
        ref={videoPlayerRef}
        className="mb-8 w-full bg-black sticky top-[var(--header-h)] z-30"
      >
        <div className="player-frame">
          {playbackType === "ad" && (
            <button
              onClick={() => {
                setCurrentVideoUrl(program.streaming_link ?? null);
                setPlayBackType("streaming");
              }}
              className="absolute bottom-4 right-0 bg-white/10 z-10 px-10 py-2 cursor-pointer hover:bg-white/20 rounded-l-md"
            >
              Skip
            </button>
          )}
          {urlType === "youtube" && youtubeId && (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              onEnded={() => {
                setCurrentVideoUrl(program.streaming_link ?? null);
                setPlayBackType("streaming");
              }}
              onLoad={() => {
                if (playbackType === "ad") {
                  setPlayBackType("ad");
                }
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          )}
          {urlType === "direct" && (
            <video
              key={currentVideoUrl}
              className="w-full h-full"
              src={currentVideoUrl ?? undefined}
              poster={program.thumbnail || undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onEnded={() => {
                if (program.streaming_link) {
                  setCurrentVideoUrl(program.streaming_link ?? null);
                  setPlayBackType("streaming");
                  playNext();
                }
              }}
            >
              Your browser does not support video playback.
            </video>
          )}
        </div>
      </div>
      {playbackType != "streaming" && (
        <div className="container mx-auto px-4 mt-14 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-20 items-start">
            <div className="md:col-span-3">
              <h2 className="text-3xl font-bold mb-6 text-white/80">
                Synopsis
              </h2>
              <p className="text-lg text-white/60 mb-10 leading-relaxed">
                {program.description}
              </p>

              <h2 className="text-3xl font-bold mb-6 text-white/80">
                Overview
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div>
                  <h3 className="text-xl font-semibold text-white/80">
                    Director
                  </h3>
                  <p className="text-white/70 mt-1 text-white/60">
                    {program.director || "N/A"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white/80">
                    Writer
                  </h3>
                  <p className="text-white/70 mt-1 text-white/60">
                    {program.writer || "N/A"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white/80">Genre</h3>
                  <p className="text-white/70 mt-1 text-white/60">
                    {program.genre || "N/A"}
                  </p>
                </div>
              </div>

              {program.content_type === "series" && (
                <div className="mt-10">
                  <h2 className="text-3xl font-bold mb-6 text-white/80 line-clamp-2">
                    Seasons
                  </h2>
                  <SeasonsAccordion
                    seasons={seasons}
                    onEpisodeSelect={() => setCurrentVideoUrl(program?.streaming_link ?? null)}
                  />
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <div className="flex items-start h-fit w-full border-b border-white/10 pb-10 mb-10">
                <div className="flex flex-col sm:flex-row items-start w-full space-y-6 sm:space-y-0 sm:space-x-6">
                  <SafeImage
                    src={program.thumbnail}
                    alt={`${program.title} poster`}
                    width={300}
                    height={450}
                    className="h-40 aspect-3/4 w-auto rounded-md"
                  />
                  <div className="w-full">
                    <h1 className="text-3xl sm:text-4xl font-bold mb-4 line-clamp-2">
                      {program.title}
                    </h1>
                    <p className="text-sm text-white/70 flex flex-col space-y-2 mt-3">
                      <span>
                        <span className="text-white font-semibold">
                          Duration:
                        </span>{" "}
                        {program.duration || "N/A"}
                      </span>
                      <span>{program.genre || "N/A"}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-6 mt-6 w-full">
                <Button
                  onClick={() => setCurrentVideoUrl(program.streaming_link)}
                  disabled={currentVideoUrl === program.streaming_link}
                  className="rounded-lg bg-gradient-to-tr to-chart-5/60 from-chart-4/60 h-12 w-full text-md text-black uppercase cursor-pointer m-0 flex items-center justify-center"
                >
                  Watch now
                </Button>
                <Button
                  onClick={handleShare}
                  className="rounded-lg hover:bg-white/60 bg-transparent to-chart-5 from-chart-4 h-12 w-full text-md text-white/40 font-light uppercase cursor-pointer border border-white/20"
                >
                  {isCopied ? "Copied!" : "Share"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {channelPrograms.length > 0 && (
        <div className="w-full mx-auto p-5 lg:p-14 mb-24">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-xl font-medium">Up next</h3>
            <Link href="/programs" className="font-normal text-md flex items-center space-x-3">
              <small>More</small>
              <ChevronRight size={18} strokeWidth={1.5}/>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">
            {channelPrograms.map((item, index) => (
              <ProgramCard
                key={index}
                title={item.title}
                src={item.thumbnail}
                alt={item.title}
                slug={`programs/${item.id}`}
                href={`/programs/${item.id}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
