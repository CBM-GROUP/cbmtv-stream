"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaControls } from "./TrackedVideo";

type Player = { playVideo: () => void; pauseVideo: () => void; destroy: () => void; seekTo: (seconds: number, allowSeekAhead: boolean) => void; getCurrentTime: () => number; getDuration: () => number; getPlayerState: () => number };
type Api = { Player: new (element: HTMLElement, options: { videoId: string; playerVars: { autoplay: number; controls: number; playsinline: number; origin: string }; events: { onReady: () => void; onStateChange: (event: { data: number }) => void; onError: () => void; onAutoplayBlocked: () => void } }) => Player };
type YouTubeWindow = Window & { YT?: Api; onYouTubeIframeAPIReady?: () => void };
let apiPromise: Promise<Api> | null = null;
function youtubeApi(): Promise<Api> {
  const browser = window as YouTubeWindow;
  if (browser.YT?.Player) return Promise.resolve(browser.YT);
  if (!apiPromise) apiPromise = new Promise<Api>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("YouTube timed out")), 15000);
    const previous = browser.onYouTubeIframeAPIReady;
    browser.onYouTubeIframeAPIReady = () => { previous?.(); clearTimeout(deadline); if (browser.YT?.Player) resolve(browser.YT); else reject(new Error("YouTube unavailable")); };
    let script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) { script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true; document.head.appendChild(script); }
    script.addEventListener("error", () => { clearTimeout(deadline); script?.remove(); reject(new Error("YouTube failed to load")); }, { once: true });
  }).catch((error) => { apiPromise = null; throw error; });
  return apiPromise;
}

export function TrackedYouTube({ videoId, session = 0, resumeAt = 0, onEnded, onFailure, onPlaybackChange, onSample, onControls }: {
  videoId: string; session?: number; resumeAt?: number; onEnded: () => void; onFailure?: () => void; onPlaybackChange?: (playing: boolean) => void; onSample?: (position: number, duration: number, urgent?: boolean, ended?: boolean) => void; onControls?: (controls: MediaControls | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null), callbacks = useRef({ onEnded, onFailure, onPlaybackChange, onSample, onControls });
  callbacks.current = { onEnded, onFailure, onPlaybackChange, onSample, onControls };
  const [status, setStatus] = useState("loading"), [attempt, setAttempt] = useState(0), playRef = useRef<() => void>(() => {});
  useEffect(() => {
    const mount = host.current; if (!mount) return;
    let disposed = false, player: Player | null = null, watched = false, failed = false, deadline: ReturnType<typeof setTimeout> | undefined;
    const sample = (urgent = false, ended = false) => { if (player && watched) callbacks.current.onSample?.(player.getCurrentTime(), player.getDuration(), urgent, ended); };
    const clear = () => { clearTimeout(deadline); deadline = undefined; };
    const wait = () => { if (!deadline) deadline = setTimeout(() => { deadline = undefined; if (!disposed) setStatus("interrupted"); }, 15000); };
    const fail = () => { if (disposed || failed) return; failed = true; clear(); setStatus("error"); callbacks.current.onPlaybackChange?.(false); callbacks.current.onFailure?.(); };
    const play = () => { if (!player || disposed) return; setStatus("loading"); wait(); player.playVideo(); };
    playRef.current = play; setStatus("loading"); callbacks.current.onPlaybackChange?.(false); wait();
    // The API replaces its mount node with an iframe. A dedicated child keeps
    // React's host stable through cleanup and Cinema Mode layout changes.
    const target = document.createElement("div"); mount.replaceChildren(target);
    void youtubeApi().then((api) => {
      if (disposed) return;
      player = new api.Player(target, { videoId, playerVars: { autoplay: 0, controls: 1, playsinline: 1, origin: location.origin }, events: {
        onReady: () => { if (disposed || !player) return; if (resumeAt > 0 && (!player.getDuration() || resumeAt < player.getDuration() * .95)) player.seekTo(resumeAt, true); callbacks.current.onControls?.({ play, pause: () => player?.pauseVideo() }); play(); },
        onStateChange: ({ data }) => { if (disposed) return; callbacks.current.onPlaybackChange?.(data === 1); if (data === 1) { watched = true; clear(); setStatus("playing"); } else if (data === 3) { setStatus("buffering"); wait(); } else if (data === 2) { clear(); sample(true); setStatus("paused"); } else if (data === 0) { clear(); sample(true, true); setStatus("paused"); callbacks.current.onEnded(); } },
        onAutoplayBlocked: () => { if (!disposed) { clear(); setStatus("blocked"); } }, onError: fail,
      } });
    }).catch(fail);
    const timer = setInterval(() => { if (player?.getPlayerState() === 1) sample(); }, 1000);
    const flush = () => sample(true);
    window.addEventListener("pagehide", flush);
    return () => { sample(true); disposed = true; clear(); clearInterval(timer); window.removeEventListener("pagehide", flush); callbacks.current.onControls?.(null); player?.destroy(); mount.replaceChildren(); };
    // Source identity, not callback or layout changes, owns the iframe lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, session, attempt]);
  const feedback = ["loading", "buffering", "blocked", "error", "interrupted"].includes(status);
  return <><div className="youtube-player" ref={host} aria-label="YouTube video player" />{feedback && <div className="player-feedback" role={status === "error" ? "alert" : "status"}><div className="rounded-lg bg-black/80 p-4 text-center text-sm"><p>{status === "error" ? "This video couldn't be loaded." : status === "blocked" ? "Press Play to start the video." : status === "interrupted" ? "Playback is taking longer than expected." : status === "buffering" ? "Buffering video..." : "Preparing video..."}</p>{!["loading", "buffering"].includes(status) && <button className="primary-action pointer-events-auto mt-3" onClick={() => { if (status === "error") setAttempt((n) => n + 1); else playRef.current(); }}>{status === "blocked" ? "Play video" : "Retry video"}</button>}</div></div>}</>;
}
