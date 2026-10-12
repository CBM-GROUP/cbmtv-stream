"use client";

import { useEffect, useRef } from "react";
import { useLibrary } from "@/context/LibraryContext";
import { useAuth } from "@/context/AuthContext";
import { checkpoint, shouldSaveCheckpoint } from "@/lib/library-playback";
import { saveProgressOnExit } from "@/services/library";
import type { PlaybackTarget } from "./TrackedVideo";

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
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

export function TrackedYouTube({ videoId, target, onEnded }: { videoId: string; target: PlaybackTarget | null; onEnded: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { saveProgress } = useLibrary();
  const { user } = useAuth();
  const saveRef = useRef(saveProgress);
  const endedRef = useRef(onEnded);
  saveRef.current = saveProgress;
  endedRef.current = onEnded;
  const contentId = target?.content;
  const episodeId = target?.episode;
  const miniseriesId = target?.miniseries;
  const startAt = target?.startAt;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const save = saveRef.current;
    const sessionToken = localStorage.getItem("access_token");
    let disposed = false;
    let player: YouTubePlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastSaved = -1;
    let queue = Promise.resolve();
    const sample = () => ({ position: player?.getCurrentTime() ?? 0, duration: player?.getDuration() ?? 0 });
    const flush = (force = false, exiting = false, ended = false) => {
      if (!contentId || !player) return;
      const sampled = sample();
      const position = ended && sampled.duration > 0 ? sampled.duration : sampled.position;
      const duration = sampled.duration;
      if (!shouldSaveCheckpoint(position, lastSaved, duration, force)) return;
      lastSaved = position;
      const data = checkpoint(contentId, position, duration, episodeId, miniseriesId);
      if (exiting) saveProgressOnExit(data, sessionToken);
      else queue = queue.then(() => save(data)).catch(() => {});
    };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const onPageHide = () => flush(true, true);
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(true, true); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    void youtubeApi().then((api) => {
      if (disposed || !mount) return;
      player = new api.Player(mount, {
        videoId,
        playerVars: { autoplay: 1, controls: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            if (startAt) player?.seekTo(startAt, true);
            player?.playVideo();
          },
          onStateChange: ({ data }) => {
            if (data === 1) {
              stop();
              timer = setInterval(() => flush(false), 1000);
            } else if (data === 2 || data === 0) {
              stop();
              flush(true, false, data === 0);
              if (data === 0) endedRef.current();
            }
          },
        },
      });
    }).catch(() => {
      // Playback remains available through the link below if the API is blocked.
    });

    return () => {
      disposed = true;
      stop();
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush(true);
      player?.destroy();
    };
  }, [videoId, contentId, episodeId, miniseriesId, startAt, user?.id]);

  return <div className="h-full w-full" ref={mountRef} aria-label="YouTube video player"><a className="text-teal-400" href={`https://www.youtube.com/watch?v=${videoId}`}>Open video on YouTube</a></div>;
}
