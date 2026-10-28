"use client";

import { useEffect, useRef } from "react";

type YouTubePlayer = {
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

export function TrackedYouTube({ videoId, onEnded, onPlaybackChange }: { videoId: string; onEnded: () => void; onPlaybackChange?: (playing: boolean) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const playbackChangeRef = useRef(onPlaybackChange);
  playbackChangeRef.current = onPlaybackChange;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let player: YouTubePlayer | null = null;

    void youtubeApi().then((api) => {
      if (disposed || !mount) return;
      player = new api.Player(mount, {
        videoId,
        playerVars: { autoplay: 1, controls: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            player?.playVideo();
          },
          onStateChange: ({ data }) => {
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
      player?.destroy();
    };
  }, [videoId]);

  return <div className="h-full w-full" ref={mountRef} aria-label="YouTube video player"><a className="text-teal-400" href={`https://www.youtube.com/watch?v=${videoId}`}>Open video on YouTube</a></div>;
}
