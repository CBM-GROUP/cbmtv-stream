"use client";

import SeasonsAccordion from "@/components/SeasonsAccordion";
import { SafeImage } from "@/components/SafeImage";
import { Button } from "@/components/ui/button";
import { useContent } from "@/hooks/useContent";
import { getMiniSeriesParts, getSeasonEpisodes, getSeriesSeasons } from "@/services/series";
import type { Episode, MiniSeries, Program, Season } from "@/types";
import {
  ChevronRight,
  Maximize,
  Minimize,
  RectangleHorizontal,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProgramCard } from "./ProgramCard";

type Props = {
  program: Program;
};

type PlayerMode = "theater" | "standard";

type PlayablePart = {
  key: string;
  title: string;
  url: string;
};

const PLAYER_MODE_KEY = "cbmtv:player-mode-v2";

/**
 * Vendor-prefixed fullscreen, still needed for Safari (including iPadOS).
 * Typed locally rather than widening the global lib types.
 */
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
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
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, Episode[]>>({});
  const [miniParts, setMiniParts] = useState<MiniSeries[]>([]);
  const [currentPart, setCurrentPart] = useState<PlayablePart | null>(null);
  const [nextPart, setNextPart] = useState<PlayablePart | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [playbackEnded, setPlaybackEnded] = useState(false);
  const [playbackSession, setPlaybackSession] = useState(0);
  // Content.trailer_link and .streaming_link are both nullable on the API.
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const videoPlayerRef = useRef<HTMLDivElement>(null);
  const [playbackType, setPlayBackType] = useState<"streaming" | "ad" | null>(
    "ad"
  );

  // Use the same default on the server and first client render. Restore a
  // returning viewer's preference after mount to avoid a hydration mismatch.
  const [playerMode, setPlayerMode] = useState<PlayerMode>("standard");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: channelContent } = useContent();

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
    let cancelled = false;
    setSeasons([]);
    setEpisodesBySeason({});
    setMiniParts([]);
    setCurrentPart(null);
    setNextPart(null);
    setPlaybackEnded(false);

    if (program.content_type === "series") {
      void getSeriesSeasons(program.id)
        .then(async (loadedSeasons) => {
          const ordered = [...loadedSeasons].sort((a, b) => a.season_number - b.season_number);
          if (!cancelled) setSeasons(ordered);
          const entries = await Promise.all(ordered.map(async (season) => {
            const episodes = await getSeasonEpisodes(season.id).catch((error) => {
              console.error(`Failed to load episodes for season ${season.id}`, error);
              return [];
            });
            return [season.id, [...episodes].sort((a, b) => a.episode_number - b.episode_number)] as const;
          }));
          if (!cancelled) {
            setEpisodesBySeason(Object.fromEntries(entries));
          }
        })
        .catch((error) => console.error("Failed to load series episodes", error));
    } else if (program.content_type === "miniseries") {
      void getMiniSeriesParts(program.id)
        .then((parts) => {
          if (!cancelled) setMiniParts([...parts].sort((a, b) => a.miniseries_no - b.miniseries_no));
        })
        .catch((error) => console.error("Failed to load miniseries parts", error));
    }
    return () => { cancelled = true; };
  }, [program.id, program.content_type]);

  // Restore the stored display preference after mount. Reading localStorage
  // during render would diverge from the server's markup.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PLAYER_MODE_KEY);
      if (stored === "theater" || stored === "standard") {
        setPlayerMode(stored);
      }
    } catch {
      // Private mode, or storage disabled. Keep the default watch layout.
    }
  }, []);

  const toggleMode = useCallback(() => {
    setPlayerMode((current) => {
      const next: PlayerMode = current === "theater" ? "standard" : "theater";
      try {
        window.localStorage.setItem(PLAYER_MODE_KEY, next);
      } catch {
        // Preference simply will not persist; the toggle still works.
      }
      return next;
    });
  }, []);

  /*
   * Fullscreen is tracked rather than assumed, because it can be left by routes
   * this component never sees -- the Escape key, the browser's own chrome, or
   * the <video> element's native control. Listening to the event is the only
   * way the surrounding layout and the button's own icon stay truthful.
   */
  useEffect(() => {
    const onChange = () => {
      const doc = document as FullscreenDocument;
      const active = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFullscreen(active === videoPlayerRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as FullscreenDocument;
    const band = videoPlayerRef.current as FullscreenElement | null;
    if (!band) return;

    const active = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

    // Requesting on the band rather than the media element means the YouTube
    // iframe and the native <video> behave identically, and the black backdrop
    // comes along so the frame stays centred and 16:9.
    if (active) {
      void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } else {
      const request = band.requestFullscreen?.bind(band) ??
        band.webkitRequestFullscreen?.bind(band);
      // Rejects when the gesture is not trusted or the API is blocked by
      // policy. The native <video> control remains as a fallback.
      void Promise.resolve(request?.()).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (program.trailer_link) {
      setCurrentVideoUrl(program.trailer_link);
      setPlayBackType("ad");
    } else {
      setCurrentVideoUrl(program.streaming_link ?? null);
      setPlayBackType("streaming");
    }
  }, [program]);

  /*
   * Scroll the player into view when the viewer switches what is playing --
   * picking an episode, skipping the trailer, hitting "Watch now".
   *
   * Not on the first pass, though. This effect also ran on mount, which yanked
   * a freshly opened page downward before the reader had done anything; the
   * player is already the top of the page there, so the scroll was pure motion.
   */
  const hasPlayedOnce = useRef(false);
  useEffect(() => {
    if (!hasPlayedOnce.current) {
      hasPlayedOnce.current = true;
      return;
    }
    videoPlayerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentVideoUrl]);

  const urlType = currentVideoUrl ? getUrlType(currentVideoUrl) : null;
  const youtubeId =
    urlType === "youtube" && currentVideoUrl
      ? getYouTubeVideoId(currentVideoUrl)
      : null;

  const channelPrograms = useMemo(() => {
    if (!channelContent) return [];
    const genre = program.genre?.trim().toLowerCase();
    return channelContent
      .filter((item) => item.id !== program.id &&
        (item.content_type === program.content_type || (genre && item.genre?.trim().toLowerCase() === genre)))
      .sort((a, b) => {
        const aGenreMatch = Number(Boolean(genre && a.genre?.trim().toLowerCase() === genre));
        const bGenreMatch = Number(Boolean(genre && b.genre?.trim().toLowerCase() === genre));
        return bGenreMatch - aGenreMatch;
      })
      .slice(0, 12);
  }, [channelContent, program.id, program.genre, program.content_type]);

  const orderedParts = useMemo<PlayablePart[]>(() => {
    if (program.content_type === "series") {
      return seasons.flatMap((season) => (episodesBySeason[season.id] ?? [])
        .filter((episode) => Boolean(episode.streaming_link))
        .map((episode) => ({
          key: `episode:${episode.id}`,
          title: episode.title,
          url: episode.streaming_link as string,
        })));
    }
    if (program.content_type === "miniseries") {
      return miniParts
        .filter((part) => Boolean(part.streaming_link))
        .map((part) => ({
          key: `part:${part.id}`,
          title: part.title,
          url: part.streaming_link as string,
        }));
    }
    return [];
  }, [program.content_type, seasons, episodesBySeason, miniParts]);

  const playPart = useCallback((part: PlayablePart) => {
    setCurrentPart(part);
    setCurrentVideoUrl(part.url);
    setPlaybackSession((session) => session + 1);
    setPlayBackType("streaming");
    setNextPart(null);
    setSecondsLeft(30);
    setPlaybackEnded(false);
  }, []);

  const handlePlaybackEnded = useCallback(() => {
    setPlaybackEnded(true);
    if (playbackType !== "streaming" || !currentPart) return;
    const index = orderedParts.findIndex((part) => part.key === currentPart.key);
    if (index >= 0 && index + 1 < orderedParts.length) {
      setSecondsLeft(30);
      setNextPart(orderedParts[index + 1]);
    }
  }, [playbackType, currentPart, orderedParts]);

  useEffect(() => {
    if (!nextPart) return;
    const timer = window.setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [nextPart]);

  useEffect(() => {
    if (nextPart && secondsLeft === 0) playPart(nextPart);
  }, [nextPart, secondsLeft, playPart]);

  return (
    <>
      <div className="watch-layout" data-player-mode={playerMode}>
      <div
        ref={videoPlayerRef}
        className="player-band group relative min-w-0 w-full bg-black"
      >
        <div className="player-frame">
          {playbackType === "ad" && (
            <button
              onClick={() => {
                setCurrentVideoUrl(program.streaming_link ?? null);
                setPlaybackSession((session) => session + 1);
                setPlayBackType("streaming");
                setCurrentPart(null);
                setPlaybackEnded(false);
                setNextPart(null);
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
              key={`${currentVideoUrl}:${playbackSession}`}
              className="w-full h-full"
              src={currentVideoUrl ?? undefined}
              poster={program.thumbnail || undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onEnded={handlePlaybackEnded}
              onPlay={() => {
                if (!nextPart) setPlaybackEnded(false);
              }}
            >
              Your browser does not support video playback.
            </video>
          )}

          {nextPart && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4">
              <div role="dialog" aria-label="Next episode" className="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-white/20 bg-neutral-950 p-6 text-center shadow-xl">
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">Up next</p>
                <h2 className="mt-2 text-xl font-bold text-white">{nextPart.title}</h2>
                <p className="mt-3 text-sm text-white/70">Starting in {secondsLeft} seconds</p>
                <div className="mt-6 flex justify-center gap-3">
                  <Button onClick={() => playPart(nextPart)} className="bg-teal-500 text-black hover:bg-teal-400">Watch next</Button>
                  <Button onClick={() => setNextPart(null)} className="border border-white/30 bg-transparent text-white hover:bg-white/10">Cancel</Button>
                </div>
              </div>
            </div>
          )}

          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {!isFullscreen && (
              <button
                type="button"
                onClick={toggleMode}
                aria-pressed={playerMode === "theater"}
                title={
                  playerMode === "theater"
                    ? "Switch to default view"
                    : "Switch to cinema mode"
                }
                className="flex items-center gap-2 h-9 px-3 rounded-md bg-black/70 text-white hover:bg-black/90 cursor-pointer backdrop-blur-sm"
              >
                {playerMode === "theater" ? (
                  <Square size={16} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <RectangleHorizontal
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                )}
                <span className="text-sm">
                  {playerMode === "theater"
                    ? "Default view"
                    : "Cinema mode"}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="flex items-center justify-center h-9 w-9 rounded-md bg-black/70 text-white hover:bg-black/90 cursor-pointer backdrop-blur-sm"
            >
              {isFullscreen ? (
                <Minimize size={16} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Maximize size={16} strokeWidth={1.75} aria-hidden="true" />
              )}
              <span className="sr-only">
                {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              </span>
            </button>
          </div>
        </div>
      </div>
      <aside className="watch-sidebar" aria-label="Movie information">
        <div className="flex items-start gap-4 border-b border-white/10 pb-6">
          <SafeImage
            src={program.thumbnail}
            alt={`${program.title} poster`}
            width={300}
            height={450}
            className="h-36 aspect-3/4 w-auto rounded-md object-cover"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">{program.title}</h1>
            <p className="mt-3 text-sm text-white/70">{program.duration || "Duration unavailable"}</p>
            <p className="mt-1 text-sm text-white/70">{program.genre || "Genre unavailable"}</p>
          </div>
        </div>
        <p className="mt-6 line-clamp-6 text-sm leading-relaxed text-white/70">
          {program.description}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            onClick={() => {
              setCurrentVideoUrl(program.streaming_link ?? null);
              setPlaybackSession((session) => session + 1);
              setPlayBackType("streaming");
              setCurrentPart(null);
              setNextPart(null);
              setPlaybackEnded(false);
            }}
            disabled={!program.streaming_link || (currentVideoUrl === program.streaming_link && playbackType === "streaming" && !playbackEnded)}
            className="h-11 w-full rounded-lg bg-gradient-to-tr from-chart-4/60 to-chart-5/60 text-black uppercase cursor-pointer"
          >
            Watch now
          </Button>
          <Button
            onClick={handleShare}
            className="h-11 w-full rounded-lg border border-white/20 bg-transparent text-white uppercase cursor-pointer hover:bg-white/10"
          >
            {isCopied ? "Copied!" : "Share"}
          </Button>
        </div>
      </aside>
      </div>
      {playbackEnded && !nextPart && (
        <div className="mx-auto mt-5 flex max-w-5xl flex-wrap items-center gap-3 px-6 text-sm text-white/75" role="status">
          <span>{playbackType === "ad" ? "Trailer finished." : "Playback finished."}</span>
          {channelPrograms.length > 0 && <a href="#similar-programs" className="text-teal-400 underline">Browse similar titles</a>}
          <Link href="/" className="text-teal-400 underline">Back to home</Link>
        </div>
      )}
      {/*
        Always rendered. This block used to be gated on
        `playbackType != "streaming"`, so pressing "Watch now" deleted the
        synopsis, cast, genre, poster, share button and the whole seasons
        accordion -- collapsing the page to a player and an "Up next" grid at
        the exact moment a viewer is most likely to want to know what they are
        watching, and taking the episode list away mid-series.
      */}
      <div className="container mx-auto px-4 mt-14 pb-24">
          <div className="max-w-4xl">
            <div>
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
                    episodesBySeason={episodesBySeason}
                    onEpisodeSelect={(episode) => {
                      if (episode.streaming_link) playPart({
                        key: `episode:${episode.id}`,
                        title: episode.title,
                        url: episode.streaming_link,
                      });
                    }}
                  />
                </div>
              )}
              {program.content_type === "miniseries" && miniParts.length > 0 && (
                <div className="mt-10">
                  <h2 className="mb-6 text-3xl font-bold text-white/80">Parts</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {miniParts.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        disabled={!part.streaming_link}
                        onClick={() => {
                          if (part.streaming_link) playPart({
                            key: `part:${part.id}`,
                            title: part.title,
                            url: part.streaming_link,
                          });
                        }}
                        className="rounded-lg border border-white/10 p-4 text-left text-white/80 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {part.miniseries_no}. {part.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
      {channelPrograms.length > 0 && (
        <div id="similar-programs" className="w-full mx-auto p-5 lg:p-14 mb-24">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-xl font-medium">Similar titles</h3>
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
