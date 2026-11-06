"use client";

import { useEffect, useRef, useState } from "react";

export type YouTubePlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  playVideo: () => void;
  mute: () => void;
  destroy: () => void;
};
export type YouTubeApi = { Player: new (element: HTMLElement, options: {
  videoId: string; width: string; height: string;
  playerVars: { autoplay: number; controls: number; playsinline: number; origin: string };
  events: {
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
    onAutoplayBlocked: () => void;
    onError: (event: { data: number }) => void;
  };
}) => YouTubePlayer };
type YouTubeWindow = Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<YouTubeApi> | null = null;
export function youtubeApi(): Promise<YouTubeApi> {
  const browser = window as YouTubeWindow;
  if (browser.YT?.Player) return Promise.resolve(browser.YT);
  if (!apiPromise) apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = browser.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.removeEventListener("error", failed);
      if (browser.onYouTubeIframeAPIReady === ready) browser.onYouTubeIframeAPIReady = previous;
      if (error) { script.remove(); reject(error); }
      else if (browser.YT?.Player) resolve(browser.YT);
      else reject(new Error("YouTube player unavailable"));
    };
    const ready = () => { try { previous?.(); } finally { finish(); } };
    const failed = () => finish(new Error("YouTube player failed to load"));
    const timeout = setTimeout(() => finish(new Error("YouTube player timed out")), 20000);
    browser.onYouTubeIframeAPIReady = ready;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", failed, { once: true });
    document.head.appendChild(script);
  }).catch((cause) => { apiPromise = null; throw cause; });
  return apiPromise;
}

type Status = "loading" | "buffering" | "blocked" | "error" | "playing" | "paused";
export function TrackedYouTube({ videoId, onEnded, onPlaybackChange, startSeconds = 0, onProgress }: {
  videoId: string; onEnded: () => void; onPlaybackChange?: (playing: boolean) => void;
  startSeconds?: number; onProgress?: (position: number, duration: number, force?: boolean) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playRef = useRef<(() => void) | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const playbackChangeRef = useRef(onPlaybackChange);
  playbackChangeRef.current = onPlaybackChange;
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const startRef = useRef(startSeconds);
  startRef.current = startSeconds;
  const retryPosition = useRef({ videoId, position: 0 });
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [errorCode, setErrorCode] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let player: YouTubePlayer | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let ready = false;
    let started = false;
    let ended = false;
    const finalProgress = progressRef.current;
    const sample = (force = false, final = false) => {
      if (!player || !started) return;
      try {
        const position = player.getCurrentTime();
        const duration = player.getDuration();
        retryPosition.current = { videoId, position };
        (final ? finalProgress : progressRef.current)?.(position, duration, force);
      } catch { /* A destroyed/blocked iframe cannot supply a sample. */ }
    };
    const clearDeadline = () => { clearTimeout(deadline); deadline = undefined; };
    const fail = (code = 0) => {
      if (disposed) return;
      clearDeadline();
      clearInterval(timer);
      setErrorCode(code);
      setStatus("error");
      playbackChangeRef.current?.(false);
    };
    const armDeadline = () => {
      if (deadline) return;
      deadline = setTimeout(() => {
        deadline = undefined;
        if (disposed) return;
        if (ready && !started) { setStatus("blocked"); playbackChangeRef.current?.(false); }
        else fail();
      }, 20000);
    };
    const play = () => {
      if (disposed || !player || !ready) return;
      setStatus("loading");
      armDeadline();
      try { player.playVideo(); } catch { fail(); }
    };
    playRef.current = play;
    setStatus("loading");
    setErrorCode(0);
    armDeadline();
    // YouTube replaces its target with an iframe. Keep React's outer node stable.
    const target = document.createElement("div");
    mount.replaceChildren(target);
    void youtubeApi().then((api) => {
      if (disposed) return;
      player = new api.Player(target, {
        videoId, width: "100%", height: "100%",
        playerVars: { autoplay: 1, controls: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            if (disposed) return;
            ready = true;
            const position = attempt > 0 && retryPosition.current.videoId === videoId ? retryPosition.current.position : startRef.current;
            if (Number.isFinite(position) && position > 0) player?.seekTo(position, true);
            play();
          },
          onStateChange: ({ data }) => {
            if (disposed) return;
            clearInterval(timer);
            if (data === 1) {
              started = true;
              clearDeadline();
              setStatus("playing");
              timer = setInterval(() => sample(), 15000);
            } else if (data === 3) {
              setStatus("buffering");
              armDeadline();
            } else if (data === 0 || data === 2) {
              clearDeadline();
              sample(true);
              setStatus("paused");
            }
            playbackChangeRef.current?.(data === 1);
            if (data === 0 && !ended) { ended = true; endedRef.current(); }
          },
          onAutoplayBlocked: () => {
            if (disposed) return;
            clearDeadline();
            clearInterval(timer);
            setStatus("blocked");
            playbackChangeRef.current?.(false);
          },
          onError: ({ data }) => fail(data),
        },
      });
      playerRef.current = player;
    }).catch(() => fail());
    const flush = () => sample(true);
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      clearInterval(timer);
      clearDeadline();
      sample(true, true);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
      playRef.current = null;
      playerRef.current = null;
      player?.destroy();
      mount.replaceChildren();
    };
  }, [videoId, attempt]);

  const unavailable = errorCode === 100 ? "This YouTube video is unavailable." : errorCode === 101 || errorCode === 150 ? "This video cannot play here. Open it on YouTube." : "YouTube playback could not load. Try again or open the video on YouTube.";
  return <div className="relative h-full w-full" aria-label="YouTube video player">
    <div className="h-full w-full" ref={mountRef} />
    {status !== "playing" && status !== "paused" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 p-4 text-center text-sm text-white" role="status">
      {status === "error" || status === "blocked" ? <div className="pointer-events-auto">
        <p className="mb-3">{status === "blocked" ? "Press Play to start this video." : unavailable}</p>
        <button type="button" className="min-h-11 rounded-md bg-white px-5 py-2 font-semibold text-black" onClick={() => {
          if (status === "blocked" && playerRef.current) playRef.current?.();
          else setAttempt((value) => value + 1);
        }}>{status === "blocked" ? "Play video" : "Retry video"}</button>
        <a className="mt-3 block min-h-11 py-3 text-teal-300 underline" href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`} target="_blank" rel="noopener noreferrer">Open video on YouTube</a>
      </div> : status === "buffering" ? "Buffering video…" : "Loading video…"}
    </div>}
  </div>;
}
