"use client";

import SeasonsAccordion from "@/components/SeasonsAccordion";
import { SafeImage } from "@/components/SafeImage";
import { Button } from "@/components/ui/button";
import { useContent } from "@/hooks/useContent";
import { getMiniSeriesParts, getSeasonEpisodes, getSeriesSeasons } from "@/services/series";
import type { Episode, MiniSeries, Program, Season } from "@/types";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProgramCard } from "./ProgramCard";
import { TrackedVideo } from "./TrackedVideo";
import { TrackedYouTube } from "./TrackedYouTube";
import { PlayerOptions } from "./PlayerOptions";
import { initialPlayback, playbackTransition } from "@/lib/playback-flow";
import { useAuth } from '@/context/AuthContext';
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress';
import { resumePosition } from '@/lib/homepage-progress';
import { useAuthorizedPlayback } from '@/hooks/useAuthorizedPlayback';
import { playbackDestination, signInDestination } from '@/lib/auth-return';

type Props = {
  program: Program;
  intent?: { play: boolean; episode?: number; miniseries?: number };
};

type PlayerMode = "theater" | "standard";

type PlayablePart = {
  key: string;
  title: string;
  url: string;
  episode?: number;
  miniseries?: number;
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

export default function ProgramDetail({ program, intent }: Props) {
  const { user, loading: authLoading } = useAuth();
  const isSeries = program.format === 'series' || program.content_type === 'series';
  const episodic = isSeries || program.content_type === 'miniseries';
  const selectionKey = `${user?.id ?? 'anonymous'}:${program.id}:${intent?.play ?? false}:${intent?.episode ?? ''}:${intent?.miniseries ?? ''}`;
  const [currentPart, setCurrentPart] = useState<PlayablePart | null>(null);
  const { progress, ready: progressReady, error: progressError, retry: retryProgress, record } = usePlaybackProgress(user?.id, program.id, currentPart?.episode, currentPart?.miniseries);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, Episode[]>>({});
  const [miniParts, setMiniParts] = useState<MiniSeries[]>([]);
  const [partsLoad, setPartsLoad] = useState<{ contentId: number; state: 'loading' | 'ready' | 'error' }>({ contentId: program.id, state: episodic ? 'loading' : 'ready' });
  const [partsAttempt, setPartsAttempt] = useState(0);
  const [initialSelection, setInitialSelection] = useState('');
  const [selectionMessage, setSelectionMessage] = useState<{ key: string; text: string } | null>(null);
  const [pendingMain, setPendingMain] = useState(false);
  const [nextPart, setNextPart] = useState<PlayablePart | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [playback, dispatchPlayback] = useState(() => initialPlayback(program.trailer_link, program.streaming_link));
  const playbackEnded = playback.phase === "ended";
  const playbackType = playback.phase === "trailer" ? "ad" : "streaming";
  const playbackSession = playback.session;
  const authorization = useAuthorizedPlayback(user?.id, program.id, currentPart?.episode, currentPart?.miniseries,
    initialSelection === selectionKey && playbackType === 'streaming' && !playbackEnded && !selectionMessage && !authLoading && progressReady && (!episodic || Boolean(currentPart)));
  const currentVideoUrl = playbackType === 'ad' ? playback.url : authorization.grant?.url ?? null;
  const openedProgram = useRef({ id: program.id, trailer: program.trailer_link, main: program.streaming_link });
  // Content.trailer_link and .streaming_link are both nullable on the API.
  const [isCopied, setIsCopied] = useState(false);
  const videoPlayerRef = useRef<HTMLDivElement>(null);

  // Use the same default on the server and first client render. Restore a
  // returning viewer's preference after mount to avoid a hydration mismatch.
  const [playerMode, setPlayerMode] = useState<PlayerMode>("standard");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

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
    let timedOut = false;
    const deadline = episodic ? setTimeout(() => {
      if (!cancelled) { timedOut = true; setPartsLoad({ contentId: program.id, state: 'error' }); }
    }, 20000) : undefined;
    setSeasons([]);
    setEpisodesBySeason({});
    setMiniParts([]);
    setCurrentPart(null);
    setNextPart(null);
    setPartsLoad({ contentId: program.id, state: episodic ? 'loading' : 'ready' });

    if (isSeries && program.content_type !== 'miniseries') {
      void getSeriesSeasons(program.id)
        .then(async (loadedSeasons) => {
          const ordered = [...loadedSeasons].sort((a, b) => a.season_number - b.season_number);
          if (!cancelled && !timedOut) setSeasons(ordered);
          const entries = await Promise.all(ordered.map(async (season) => {
            const episodes = await getSeasonEpisodes(season.id);
            return [season.id, [...episodes].sort((a, b) => a.episode_number - b.episode_number)] as const;
          }));
          if (!cancelled && !timedOut) {
            clearTimeout(deadline);
            setEpisodesBySeason(Object.fromEntries(entries));
            setPartsLoad({ contentId: program.id, state: 'ready' });
          }
        })
        .catch(() => { clearTimeout(deadline); if (!cancelled && !timedOut) setPartsLoad({ contentId: program.id, state: 'error' }); });
    } else if (program.content_type === "miniseries") {
      void getMiniSeriesParts(program.id)
        .then((parts) => {
          if (!cancelled && !timedOut) {
            clearTimeout(deadline);
            setMiniParts([...parts].sort((a, b) => a.miniseries_no - b.miniseries_no));
            setPartsLoad({ contentId: program.id, state: 'ready' });
          }
        })
        .catch(() => { clearTimeout(deadline); if (!cancelled && !timedOut) setPartsLoad({ contentId: program.id, state: 'error' }); });
    }
    return () => { cancelled = true; clearTimeout(deadline); };
  }, [program.id, program.content_type, isSeries, episodic, partsAttempt]);

  const viewerContent = `${user?.id ?? 'anonymous'}:${program.id}`;
  const previousViewerContent = useRef(viewerContent);
  useEffect(() => {
    if (previousViewerContent.current === viewerContent) return;
    previousViewerContent.current = viewerContent;
    setCurrentPart(null);
    setNextPart(null);
    setPendingMain(false);
    setSelectionMessage(null);
    setInitialSelection('');
    dispatchPlayback(state => playbackTransition(state, { type: 'open', trailer: program.trailer_link, main: null }));
  }, [viewerContent, program.trailer_link]);

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
    if (openedProgram.current.id === program.id &&
        openedProgram.current.trailer === program.trailer_link &&
        openedProgram.current.main === program.streaming_link) return;
    openedProgram.current = { id: program.id, trailer: program.trailer_link, main: program.streaming_link };
    dispatchPlayback((state) => playbackTransition(state, {
      type: "open", trailer: program.trailer_link, main: program.streaming_link,
    }));
  }, [program.id, program.trailer_link, program.streaming_link]);

  /*
   * Scroll the player into view when the viewer switches what is playing --
   * picking an episode, switching to the trailer, hitting "Watch now".
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
    if (isSeries && program.content_type !== 'miniseries') {
      return seasons.flatMap((season) => (episodesBySeason[season.id] ?? [])
        .filter((episode) => Boolean(episode.playback_available || episode.streaming_link))
        .map((episode) => ({
          key: `episode:${episode.id}`,
          title: episode.title,
          url: episode.streaming_link || '',
          episode: episode.id,
        })));
    }
    if (program.content_type === "miniseries") {
      return miniParts
        .filter((part) => Boolean(part.playback_available || part.streaming_link))
        .map((part) => ({
          key: `part:${part.id}`,
          title: part.title,
          url: part.streaming_link || '',
          miniseries: part.id,
        }));
    }
    return [];
  }, [program.content_type, isSeries, seasons, episodesBySeason, miniParts]);

  const playPart = useCallback((part: PlayablePart) => {
    setCurrentPart(part);
    setPendingMain(false);
    setSelectionMessage(null);
    setInitialSelection(selectionKey);
    dispatchPlayback((state) => playbackTransition(state, { type: "playMain", url: part.url }));
    setNextPart(null);
    setSecondsLeft(30);
  }, [selectionKey]);

  const startMain = useCallback(() => {
    setSelectionMessage(null);
    if (currentPart) { playPart(currentPart); return; }
    if (episodic) setPendingMain(true);
    dispatchPlayback((state) => playbackTransition(state, { type: 'playMain', url: null }));
  }, [currentPart, episodic, playPart]);

  const partsReady = partsLoad.contentId === program.id && partsLoad.state === 'ready';
  const partsFailed = partsLoad.contentId === program.id && partsLoad.state === 'error';
  useEffect(() => {
    if (authLoading || !progressReady || initialSelection === selectionKey) return;
    const saved = progress;
    const resume = Boolean(saved && (saved.position_seconds > 0 || (saved.completed && (saved.episode || saved.miniseries))));
    const explicitPart = Boolean(intent?.episode || intent?.miniseries);
    if (!intent?.play && !explicitPart && !resume && !pendingMain && program.trailer_link) {
      setInitialSelection(selectionKey);
      return;
    }
    if (episodic && !partsReady) {
      if (partsFailed) {
        setSelectionMessage({ key: selectionKey, text: "Couldn't load episodes. Try again." });
        setInitialSelection(selectionKey);
      }
      return;
    }
    const episode = intent?.episode ?? saved?.episode ?? undefined;
    const miniseries = intent?.miniseries ?? saved?.miniseries ?? undefined;
    let part = orderedParts.find((candidate) => episode ? candidate.episode === episode : miniseries ? candidate.miniseries === miniseries : false);
    setInitialSelection(selectionKey);
    if ((episode || miniseries) && !part) {
      setSelectionMessage({ key: selectionKey, text: explicitPart ? 'The requested episode or part is unavailable. Choose another below.' : 'Your saved episode or part is unavailable. Choose another below.' });
      return;
    }
    if (part && saved?.completed && !explicitPart) {
      const next = orderedParts[orderedParts.findIndex(candidate => candidate.key === part?.key) + 1];
      if (!next) {
        setCurrentPart(part);
        setSelectionMessage({ key: selectionKey, text: 'You finished this episode. Choose an episode below or press Watch now to replay it.' });
        dispatchPlayback(state => playbackTransition(playbackTransition(state, { type: 'playMain', url: null }), { type: 'ended' }));
        return;
      }
      part = next;
    }
    if (part) playPart(part);
    else if (episodic && orderedParts[0]) playPart(orderedParts[0]);
    else if (episodic) setSelectionMessage({ key: selectionKey, text: 'No episodes are available for playback yet.' });
    else dispatchPlayback((state) => playbackTransition(state, { type: 'playMain', url: null }));
  }, [intent, authLoading, program.streaming_link, program.playback_available, program.trailer_link, progress, orderedParts, playPart, progressReady, initialSelection, selectionKey, pendingMain, episodic, partsReady, partsFailed]);

  useEffect(() => {
    if (!pendingMain || initialSelection !== selectionKey || currentPart || !episodic) return;
    if (partsFailed) {
      setSelectionMessage({ key: selectionKey, text: "Couldn't load episodes. Try again." });
      setPendingMain(false);
    } else if (partsReady) {
      if (orderedParts[0]) playPart(orderedParts[0]);
      else { setSelectionMessage({ key: selectionKey, text: 'No episodes are available for playback yet.' }); setPendingMain(false); }
    }
  }, [pendingMain, initialSelection, selectionKey, currentPart, episodic, partsFailed, partsReady, orderedParts, playPart]);

  const playbackIdentity = `${viewerContent}:${currentPart?.key ?? 'movie'}:${playbackSession}`;
  const activePlaybackIdentity = useRef(playbackIdentity);
  activePlaybackIdentity.current = playbackIdentity;
  const playhead = useRef<{ key: string; position: number } | null>(null);
  const startSeconds = playbackType === 'streaming' ? playhead.current?.key === playbackIdentity ? playhead.current.position : resumePosition(progress, currentPart?.episode, currentPart?.miniseries) : 0;
  const trackProgress = (position: number, duration: number, force = false) => {
    if (playbackType === 'streaming' && activePlaybackIdentity.current === playbackIdentity && Number.isFinite(position) && Number.isFinite(duration) && position >= 0 && duration > 0) playhead.current = { key: playbackIdentity, position: Math.min(position, duration) };
    if (playbackType === 'streaming' && user && progressReady) record(position, duration, currentPart?.episode, currentPart?.miniseries, force);
  };

  const handlePlaybackEnded = useCallback(() => {
    if (playbackType === "ad") {
      startMain();
      return;
    }
    dispatchPlayback((state) => playbackTransition(state, { type: "ended" }));
    if (playbackType !== "streaming" || !currentPart) return;
    const index = orderedParts.findIndex((part) => part.key === currentPart.key);
    if (index >= 0 && index + 1 < orderedParts.length) {
      setSecondsLeft(30);
      setNextPart(orderedParts[index + 1]);
    }
  }, [playbackType, currentPart, orderedParts, startMain]);

  useEffect(() => {
    if (!nextPart) return;
    const timer = window.setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [nextPart]);

  useEffect(() => {
    if (nextPart && secondsLeft === 0) playPart(nextPart);
  }, [nextPart, secondsLeft, playPart]);

  const playerMessage = selectionMessage?.key === selectionKey ? selectionMessage.text : null;
  const retryParts = () => {
    setSelectionMessage(null);
    setPartsLoad({ contentId: program.id, state: 'loading' });
    setInitialSelection('');
    setPendingMain(true);
    setPartsAttempt(value => value + 1);
  };

  return (
    <>
      <div className="watch-layout" data-player-mode={playerMode}>
      <div
        ref={videoPlayerRef}
        className="player-band group relative min-w-0 w-full bg-black"
        onPlayingCapture={() => setIsPlaying(true)}
        onPauseCapture={() => setIsPlaying(false)}
        onEndedCapture={() => setIsPlaying(false)}
      >
        <div className="player-frame">
          {playbackType === "ad" && Boolean(program.playback_available || program.streaming_link || episodic || orderedParts.length) && (
            <button
              onClick={startMain}
              className="absolute bottom-16 right-3 bg-black/70 z-10 px-3 py-2 cursor-pointer hover:bg-black/90 rounded-md text-sm"
            >
              Skip
            </button>
          )}
          {authLoading || initialSelection !== selectionKey ? <div className="flex h-full items-center justify-center px-4 text-center text-white/75" role="status">{progressError ? <button className="primary-action" onClick={retryProgress}>Couldn&apos;t load saved progress. Try again</button> : episodic && !partsReady && (pendingMain || intent?.play) ? 'Loading episodes...' : 'Loading playback...'}</div> :
          playerMessage ? <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-white/75" role="status"><p>{playerMessage}</p>{partsFailed && <button className="primary-action" onClick={retryParts}>Retry episodes</button>}</div> :
          playbackType === 'streaming' && !user ? <div className="flex h-full items-center justify-center px-4 text-center"><Link className="primary-action" href={signInDestination(playbackDestination(program.id, currentPart ?? undefined))}>Sign in to watch</Link></div> :
          playbackEnded ? <div className="flex h-full items-center justify-center px-4 text-center text-white/75" role="status">Playback finished. Press Watch now to replay.</div> :
          playbackType === 'streaming' && (authLoading || !progressReady || !authorization.grant) ? <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-white/75" role="status">{progressError ? <button className="primary-action" onClick={retryProgress}>Couldn&apos;t load saved progress. Try again</button> : authorization.message ? <><p>{authorization.message}</p><button className="primary-action" onClick={authorization.retry}>Retry playback</button></> : 'Loading playback...'}</div> : <>
          {urlType === "youtube" && youtubeId && (
            <TrackedYouTube key={`${currentVideoUrl}:${playbackSession}:${user?.id ?? 'anonymous'}`} videoId={youtubeId} startSeconds={startSeconds} onProgress={trackProgress} onEnded={handlePlaybackEnded} onPlaybackChange={setIsPlaying} />
          )}
          {urlType === "direct" && (
            <TrackedVideo
              key={`${currentVideoUrl}:${playbackSession}:${user?.id ?? 'anonymous'}`}
              src={currentVideoUrl as string}
              sourceType={playbackType === 'streaming' ? authorization.grant?.type : undefined}
              withCredentials={playbackType === 'streaming' && authorization.grant?.with_credentials}
              startSeconds={startSeconds}
              onProgress={trackProgress}
              onEnded={handlePlaybackEnded}
              onPlay={() => {
                if (!nextPart) dispatchPlayback((state) => playbackTransition(state, { type: "playing" }));
              }}
            />
          )}
          {!urlType && (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/70" role="status">
              {currentVideoUrl ? "This video link is unsupported." : "Video is unavailable."}
            </div>
          )}
          </>}

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

          <PlayerOptions playerRef={videoPlayerRef} playing={isPlaying && !playbackEnded && !nextPart} cinema={playerMode === "theater"} fullscreen={isFullscreen} onCinema={toggleMode} onFullscreen={toggleFullscreen} />
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
          <div className="min-w-0 flex-1">
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
              startMain();
            }}
            disabled={!(program.playback_available || program.streaming_link || orderedParts.length) || (playbackType === 'streaming' && !playbackEnded)}
            className="h-11 w-full rounded-lg bg-gradient-to-tr from-chart-4/60 to-chart-5/60 text-black uppercase cursor-pointer"
          >
            Watch now
          </Button>
          {program.trailer_link && (
            <Button
              onClick={() => {
                dispatchPlayback((state) => playbackTransition(state, { type: "playTrailer", url: program.trailer_link as string }));
                setCurrentPart(null);
                setNextPart(null);
                setSelectionMessage(null);
                setPendingMain(false);
                setInitialSelection(selectionKey);
              }}
              disabled={playbackType === "ad" && !playbackEnded}
              className="h-11 w-full rounded-lg border border-white/20 bg-transparent text-white uppercase cursor-pointer hover:bg-white/10"
            >
              Watch trailer
            </Button>
          )}
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

              {isSeries && program.content_type !== 'miniseries' && (
                <div className="mt-10">
                  <h2 className="text-3xl font-bold mb-6 text-white/80 line-clamp-2">
                    Seasons
                  </h2>
                  <SeasonsAccordion
                    seasons={seasons}
                    episodesBySeason={episodesBySeason}
                    onEpisodeSelect={(episode) => {
                      if (episode.playback_available || episode.streaming_link) playPart({
                        key: `episode:${episode.id}`,
                        title: episode.title,
                        url: episode.streaming_link || '',
                        episode: episode.id,
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
                        disabled={!part.playback_available && !part.streaming_link}
                        onClick={() => {
                          if (part.playback_available || part.streaming_link) playPart({
                            key: `part:${part.id}`,
                            title: part.title,
                            url: part.streaming_link || '',
                            miniseries: part.id,
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
                id={item.id}
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
