"use client";

import SeasonsAccordion from "@/components/SeasonsAccordion";
import { Button } from "@/components/ui/button";
import { getMiniSeriesParts, getSeasonEpisodes, getSeriesSeasons } from "@/services/series";
import type { Episode, MiniSeries, Program, Season } from "@/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContentRail } from "./ContentRail";
import { AdvertisingVideo } from "./AdvertisingVideo";
import { SponsoredPlacement } from './SponsoredPlacement';
import { TrackedYouTube } from "./TrackedYouTube";
import { PlayerOptions } from "./PlayerOptions";
import { initialPlayback, playbackTransition } from "@/lib/playback-flow";
import { useAuth } from '@/context/AuthContext';
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress';
import { resumePosition } from '@/lib/homepage-progress';
import { useAuthorizedPlayback } from '@/hooks/useAuthorizedPlayback';
import { playbackDestination, signInDestination } from '@/lib/auth-return';
import { getSimilar, recordDetailOpened, recordPlaybackEvent } from '@/services/discovery';

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
  const analytics = useRef<{ sessionId: string; firstPosition: number; duration: number; lastSent: number } | null>(null);
  const currentVideoUrl = playbackType === 'ad' ? playback.url : authorization.grant?.url ?? null;
  const openedProgram = useRef({ id: program.id, trailer: program.trailer_link, main: program.streaming_link });
  // Content.trailer_link and .streaming_link are both nullable on the API.
  const [isCopied, setIsCopied] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const videoPlayerRef = useRef<HTMLDivElement>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);

  // Use the same default on the server and first client render. Restore a
  // returning viewer's preference after mount to avoid a hydration mismatch.
  const [playerMode, setPlayerMode] = useState<PlayerMode>("standard");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [similarPrograms, setSimilarPrograms] = useState<Program[]>([]);
  const [similarError, setSimilarError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setSimilarPrograms([]);
    setSimilarError(false);
    void getSimilar(program.id, controller.signal).then(data => {
      if (!controller.signal.aborted) setSimilarPrograms(data.items);
    }).catch(() => { if (!controller.signal.aborted) setSimilarError(true); });
    void recordDetailOpened(program.id);
    return () => controller.abort();
  }, [program.id]);

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

  const handleTrailer = () => {
    if (!program.trailer_link) return;
    dispatchPlayback((state) => playbackTransition(state, { type: "playTrailer", url: program.trailer_link as string }));
    setCurrentPart(null);
    setNextPart(null);
    setSelectionMessage(null);
    setPendingMain(false);
    setInitialSelection(selectionKey);
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

  // Direct video can be wider or narrower than its 16:9 player box. Keep the
  // trailer action inside the rendered image, including after mode changes.
  const updateSkipBounds = useCallback(() => {
    const frame = videoFrameRef.current;
    if (!frame) return;
    const video = frame.querySelector('video');
    if (!video?.videoWidth || !video.videoHeight) {
      frame.style.removeProperty('--skip-video-right');
      frame.style.removeProperty('--skip-video-bottom');
      return;
    }
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    const aspect = video.videoWidth / video.videoHeight;
    const visibleWidth = Math.min(width, height * aspect);
    const visibleHeight = Math.min(height, width / aspect);
    frame.style.setProperty('--skip-video-right', `${(width - visibleWidth) / 2 + 12}px`);
    frame.style.setProperty('--skip-video-bottom', `${(height - visibleHeight) / 2 + 52}px`);
  }, []);

  useEffect(() => {
    const frame = videoFrameRef.current;
    if (!frame) return;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSkipBounds) : null;
    observer?.observe(frame);
    updateSkipBounds();
    return () => observer?.disconnect();
  }, [currentVideoUrl, updateSkipBounds]);

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
   * picking an episode, switching to the trailer, or replaying.
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
        setSelectionMessage({ key: selectionKey, text: 'You finished this episode. Choose an episode below or use Replay to watch it again.' });
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
    const sample = analytics.current;
    if (playbackType === 'streaming' && user && sample && sample.sessionId === authorization.grant?.session_id &&
        Number.isFinite(position) && Number.isFinite(duration) && duration > 0 && position - sample.firstPosition >= 10 &&
        Date.now() - sample.lastSent >= 15000) {
      sample.lastSent = Date.now();
      sample.duration = duration;
      void recordPlaybackEvent('playback_progress', sample.sessionId, position, duration);
    }
  };

  const handlePlaybackEnded = useCallback(() => {
    if (playbackType === "ad") {
      startMain();
      return;
    }
    if (analytics.current && user && playhead.current?.key === playbackIdentity) {
      void recordPlaybackEvent('playback_completed', analytics.current.sessionId,
        playhead.current.position, analytics.current.duration);
    }
    dispatchPlayback((state) => playbackTransition(state, { type: "ended" }));
    if (playbackType !== "streaming" || !currentPart) return;
    const index = orderedParts.findIndex((part) => part.key === currentPart.key);
    if (index >= 0 && index + 1 < orderedParts.length) {
      setSecondsLeft(30);
      setNextPart(orderedParts[index + 1]);
    }
  }, [playbackType, currentPart, orderedParts, startMain, user, playbackIdentity]);

  useEffect(() => {
    if (!nextPart) return;
    const timer = window.setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [nextPart]);

  useEffect(() => {
    if (nextPart && secondsLeft === 0) playPart(nextPart);
  }, [nextPart, secondsLeft, playPart]);

  const playerMessage = selectionMessage?.key === selectionKey ? selectionMessage.text : null;
  const synopsisCanExpand = program.description.length > 140;
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
        onLoadedMetadataCapture={updateSkipBounds}
      >
        <div ref={videoFrameRef} className="player-frame">
          {playbackType === "ad" && Boolean(program.playback_available || program.streaming_link || episodic || orderedParts.length) && (
            <button
              onClick={startMain}
              className="skip-trailer absolute z-10 inline-flex min-h-11 items-center rounded-md border border-white/25 bg-black/65 px-3 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/85"
              aria-label="Skip trailer and start playback"
            >
              Skip trailer
            </button>
          )}
          {authLoading || initialSelection !== selectionKey ? <div className="flex h-full items-center justify-center px-4 text-center text-white/75" role="status">{progressError ? <button className="primary-action" onClick={retryProgress}>Couldn&apos;t load saved progress. Try again</button> : episodic && !partsReady && (pendingMain || intent?.play) ? 'Loading episodes...' : 'Loading playback...'}</div> :
          playerMessage ? <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-white/75" role="status"><p>{playerMessage}</p>{partsFailed && <button className="primary-action" onClick={retryParts}>Retry episodes</button>}{playbackEnded && <button type="button" className="player-replay" onClick={startMain}>Replay</button>}</div> :
          playbackType === 'streaming' && !user ? <div className="flex h-full items-center justify-center px-4 text-center"><Link className="primary-action" href={signInDestination(playbackDestination(program.id, currentPart ?? undefined))}>Sign in to watch</Link></div> :
          playbackEnded ? <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-white/75" role="status"><p>Playback finished.</p><button type="button" className="player-replay" onClick={startMain}>Replay</button></div> :
          playbackType === 'streaming' && (authLoading || !progressReady || !authorization.grant) ? <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-white/75" role="status">{progressError ? <button className="primary-action" onClick={retryProgress}>Couldn&apos;t load saved progress. Try again</button> : authorization.message ? <><p>{authorization.message}</p><button className="primary-action" onClick={authorization.retry}>Retry playback</button></> : 'Loading playback...'}</div> : <>
          {urlType === "youtube" && youtubeId && (
            <TrackedYouTube key={`${currentVideoUrl}:${playbackSession}:${user?.id ?? 'anonymous'}`} videoId={youtubeId} startSeconds={startSeconds} onProgress={trackProgress} onEnded={handlePlaybackEnded} onPlaybackChange={setIsPlaying} />
          )}
          {urlType === "direct" && (
            <AdvertisingVideo
              key={`${playbackType}:${playbackSession}:${user?.id ?? 'anonymous'}:${authorization.grant?.session_id ?? ''}`}
              advertisingEnabled={playbackType === 'streaming' && authorization.grant?.advertising_enabled}
              viewerId={user?.id}
              playbackSessionId={authorization.grant?.session_id}
              src={currentVideoUrl as string}
              sourceType={playbackType === 'streaming' ? authorization.grant?.type : undefined}
              withCredentials={playbackType === 'streaming' && authorization.grant?.with_credentials}
              startSeconds={startSeconds}
              onProgress={trackProgress}
              onEnded={handlePlaybackEnded}
              onPlay={(position, duration) => {
                const sessionId = authorization.grant?.session_id;
                if (playbackType === 'streaming' && user && sessionId && analytics.current?.sessionId !== sessionId) {
                  analytics.current = { sessionId, firstPosition: position, duration: Number.isFinite(duration) && duration > 0 ? duration : Math.max(position + 1, 1), lastSent: Date.now() };
                  void recordPlaybackEvent('playback_started', sessionId, position, analytics.current.duration);
                }
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

          <PlayerOptions playerRef={videoPlayerRef} playing={isPlaying && !playbackEnded && !nextPart} cinema={playerMode === "theater"} fullscreen={isFullscreen} onCinema={toggleMode} onFullscreen={toggleFullscreen} onTrailer={program.trailer_link ? handleTrailer : undefined} onShare={handleShare} copied={isCopied} />
        </div>
      </div>
      <aside className="watch-sidebar" aria-label="Movie information">
      <section className="watch-details" aria-label="Title details">
        <h1 className="watch-title">{program.title}</h1>
        {(program.duration || program.genre) && <p className="watch-metadata">{[program.duration, program.genre].filter(Boolean).join(" / ")}</p>}
        {program.description && <div className="watch-synopsis">
          <p id="watch-synopsis-text" className={!synopsisExpanded && synopsisCanExpand ? "line-clamp-3" : ""}>{program.description}</p>
          {synopsisCanExpand && <button type="button" className="watch-expand" aria-expanded={synopsisExpanded} aria-controls="watch-synopsis-text" onClick={() => setSynopsisExpanded(value => !value)}>{synopsisExpanded ? "Show less" : "More details"}</button>}
        </div>}
        {program.director && <p className="watch-director"><span>Director</span> {program.director}</p>}

              {isSeries && program.content_type !== 'miniseries' && (
                <div className="watch-parts">
                  <h2 className="watch-section-title">Episodes</h2>
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
                <div className="watch-parts">
                  <h2 className="watch-section-title">Parts</h2>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                         className="min-h-11 rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {part.miniseries_no}. {part.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
      </section>
      <div className="watch-sponsor"><SponsoredPlacement placement="content_sponsor" context="content" content={program.id} /></div>
      </aside>
      </div>
      {playbackEnded && !nextPart && (
        <div className="mx-auto mt-5 flex max-w-5xl flex-wrap items-center gap-3 px-6 text-sm text-white/75" role="status">
          <span>{playbackType === "ad" ? "Trailer finished." : "Playback finished."}</span>
          {similarPrograms.length > 0 && <a href="#similar-programs" className="text-teal-400 underline">Browse similar titles</a>}
          <Link href="/" className="text-teal-400 underline">Back to home</Link>
        </div>
      )}
      {(similarPrograms.length > 0 || similarError) && (
        <div id="similar-programs" className="watch-similar">
          <ContentRail title="Similar titles" items={similarPrograms} source="similar" moreHref="/programs" />
          {similarError && <p role="alert" className="content-section text-sm text-white/65">Similar titles are unavailable right now.</p>}
        </div>
      )}
    </>
  );
}
