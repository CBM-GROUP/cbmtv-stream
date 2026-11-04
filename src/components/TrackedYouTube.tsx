"use client";

import { useEffect, useRef } from "react";

type YouTubePlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  playVideo: () => void;
  destroy: () => void;
};
type YouTubeApi = { Player: new (element: HTMLElement, options: {
  videoId: string;
  playerVars: { autoplay: number; controls: number; playsinline: number; origin: string };
  events: { onReady: () => void; onStateChange: (event: { data: number }) => void };
}) => YouTubePlayer };
type YouTubeWindow = Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<YouTubeApi> | null = null;
function youtubeApi(): Promise<YouTubeApi> {
  const browser = window as YouTubeWindow;
  if (browser.YT?.Player) return Promise.resolve(browser.YT);
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    const previous = browser.onYouTubeIframeAPIReady;
    browser.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (browser.YT?.Player) resolve(browser.YT);
      else reject(new Error("YouTube player unavailable"));
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player failed to load"));
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function TrackedYouTube({ videoId, onEnded, onPlaybackChange, startSeconds = 0, onProgress }: { videoId: string; onEnded: () => void; onPlaybackChange?: (playing: boolean) => void; startSeconds?: number; onProgress?: (position: number, duration: number, force?: boolean) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const playbackChangeRef = useRef(onPlaybackChange);
  playbackChangeRef.current = onPlaybackChange;
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const startRef = useRef(startSeconds);
  startRef.current = startSeconds;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let player: YouTubePlayer | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sample = (force = false) => { if (player) progressRef.current?.(player.getCurrentTime(), player.getDuration(), force); };

    void youtubeApi().then((api) => {
      if (disposed || !mount) return;
      player = new api.Player(mount, {
        videoId,
        playerVars: { autoplay: 1, controls: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            if (startRef.current > 0) player?.seekTo(startRef.current, true);
            player?.playVideo();
          },
          onStateChange: ({ data }) => {
            if (timer) clearInterval(timer);
            if (data === 1) timer = setInterval(() => sample(), 15000);
            if (data === 0 || data === 2) sample(true);
            playbackChangeRef.current?.(data === 1);
            if (data === 0) endedRef.current();
          },
        },
      });
    }).catch(() => {
      // Playback remains available through the link below if the API is blocked.
    });

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      sample(true);
      player?.destroy();
    };
  }, [videoId]);

  return <div className="h-full w-full" ref={mountRef} aria-label="YouTube video player"><a className="text-teal-400" href={`https://www.youtube.com/watch?v=${videoId}`}>Open video on YouTube</a></div>;
}
