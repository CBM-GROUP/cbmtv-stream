"use client";

import SeasonsAccordion from "@/components/SeasonsAccordion";
import { Button } from "@/components/ui/button";
import { getSeriesSeasons } from "@/services/series";
import MuxPlayer from "@mux/mux-player-react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Program = {
  id: number;
  content_type: string;
  title: string;
  description: string;
  thumbnail: string;
  streaming_link: string;
  trailer_link?: string;
  duration: string;
  director: string;
  writer?: string;
  genre?: string;
  size?: string;
};

type Season = {
  id: number;
  title: string;
  season_number: number;
};

type Props = {
  program: Program;
};

function getUrlType(url: string): "youtube" | "mux" | "other" | null {
  if (!url) return null;
  try {
    const urlObject = new URL(url);
    if (
      urlObject.hostname.includes("youtube.com") ||
      urlObject.hostname.includes("youtu.be")
    ) {
      return "youtube";
    }
    if (urlObject.hostname.includes("mux.com")) {
      return "mux";
    }
    return "other";
  } catch (error) {
    console.error("Error getting URL type:", error);
    return "other";
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

function getPlaybackId(url: string): string | null {
  if (!url) {
    return null;
  }
  try {
    const urlObject = new URL(url);
    if (!urlObject.hostname.includes("mux.com")) {
      return null;
    }
    const pathname = urlObject.pathname;
    const playbackId = pathname.split("/")[1].split(".")[0];
    return playbackId;
  } catch (error) {
    console.error("Error extracting playback ID:", error);
    return null;
  }
}

const PLACEHOLDER_IMAGE = "/images/cbmtvwhitelogo.png";

export default function ProgramDetail({ program }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(
    program.trailer_link || program.streaming_link
  );
  const [isCopied, setIsCopied] = useState(false);
  const videoPlayerRef = useRef<HTMLDivElement>(null);

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
    if (program.content_type === "series") {
      getSeriesSeasons(program.id).then((res) => {
        setSeasons(res.data);
      });
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
  const playbackId =
    urlType === "mux" && currentVideoUrl
      ? getPlaybackId(currentVideoUrl)
      : null;
  const youtubeId =
    urlType === "youtube" && currentVideoUrl
      ? getYouTubeVideoId(currentVideoUrl)
      : null;

  return (
    <>
      <div ref={videoPlayerRef} className="aspect-video mb-8 w-screen bg-black">
        {urlType === "mux" && playbackId && (
          <MuxPlayer
            className="w-full h-full rounded-none"
            playbackId={playbackId}
            title={program.title}
            autoPlay
            onEnded={() => setCurrentVideoUrl(program.streaming_link)}
          />
        )}
        {urlType === "youtube" && youtubeId && (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
            title="YouTube video player"
            frameBorder="0"
            onEnded={() => setCurrentVideoUrl(program.streaming_link)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        )}
      </div>
      <div className="container mx-auto px-4 mt-14 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-20 items-start">
          <div className="md:col-span-3">
            <h2 className="text-3xl font-bold mb-6 text-white/80">Synopsis</h2>
            <p className="text-lg text-white/60 mb-10 leading-relaxed">
              {program.description}
            </p>

            <h2 className="text-3xl font-bold mb-6 text-white/80">Overview</h2>
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
                <h3 className="text-xl font-semibold text-white/80">Writer</h3>
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
                <h2 className="text-3xl font-bold mb-6 text-white/80">
                  Seasons
                </h2>
                <SeasonsAccordion
                  seasons={seasons}
                  onEpisodeSelect={setCurrentVideoUrl}
                />
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <div className="flex items-start h-fit w-full border-b border-white/10 pb-10 mb-10">
              <div className="flex flex-col sm:flex-row items-start w-full space-y-6 sm:space-y-0 sm:space-x-6">
                <Image
                  src={program.thumbnail || PLACEHOLDER_IMAGE}
                  alt={`${program.title} poster`}
                  width={300}
                  height={450}
                  className="h-40 aspect-3/4 w-auto rounded-md"
                />
                <div className="w-full">
                  <h1 className="text-3xl sm:text-4xl font-bold mb-4">
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
    </>
  );
}
