"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type Hls from "hls.js";
import { playbackMetric } from "@/lib/player-metrics";

type Status = "loading" | "buffering" | "blocked" | "error" | "playing" | "paused";
type Quality = { index: number; height: number; bitrate: number };

export function TrackedVideo({ src, onEnded, onPlay, startSeconds = 0, onProgress, withCredentials = false, sourceType }: {
  src: string;
  onEnded: () => void;
  onPlay: () => void;
  startSeconds?: number;
  onProgress?: (position: number, duration: number, force?: boolean) => void;
  withCredentials?: boolean;
  sourceType?: "hls" | "progressive";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const startRef = useRef(startSeconds);
  startRef.current = startSeconds;
  const started = useRef(false);
  const playRef = useRef<(() => void) | null>(null);
  const retryPosition = useRef<{ src: string; position: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [quality, setQuality] = useState(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let terminal = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let recovery: ReturnType<typeof setTimeout> | undefined;
    let instance: Hls | null = null;
    let networkRetries = 0;
    let mediaRetries = 0;
    let firstFrame = false;
    let bufferingAt: number | null = null;
    let position = retryPosition.current?.src === src ? retryPosition.current.position : startRef.current;
    let openedAt = performance.now();
    let autoplayBlocked = false;
    // Source cleanup must use that source's viewer callback, not a new account's.
    const finalProgress = progressRef.current;
    started.current = false;
    setStatus("loading");
    setQualities([]);
    setQuality(-1);

    const clearDeadline = () => { clearTimeout(deadline); deadline = undefined; };
    const fail = (code: number) => {
      if (disposed || terminal) return;
      terminal = true;
      clearDeadline();
      clearTimeout(recovery);
      instance?.stopLoad();
      setStatus("error");
      playbackMetric("error", { code, attempt });
    };
    const armDeadline = () => {
      if (!deadline && !terminal) deadline = setTimeout(() => fail(1), 20000);
    };
    const play = () => {
      if (disposed || terminal) return;
      if (autoplayBlocked && !firstFrame) { openedAt = performance.now(); autoplayBlocked = false; }
      armDeadline();
      void video.play().catch((error: unknown) => {
        if (disposed || terminal) return;
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          clearDeadline();
          autoplayBlocked = true;
          setStatus("blocked");
        } else if (!(error instanceof DOMException && error.name === "AbortError")) fail(3);
      });
    };
    playRef.current = play;
    const restore = () => {
      if (Number.isFinite(position) && position > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(position, Math.max(0, video.duration - 1));
    };
    const waiting = () => {
      if (terminal || (firstFrame && video.paused)) return;
      if (firstFrame && bufferingAt === null && !video.seeking) bufferingAt = performance.now();
      setStatus(firstFrame ? "buffering" : "loading");
      armDeadline();
    };
    const playing = () => {
      if (terminal) { video.pause(); return; }
      clearDeadline();
      const now = performance.now();
      if (!firstFrame) { playbackMetric("startup", { duration_ms: now - openedAt }); firstFrame = true; }
      if (bufferingAt !== null) playbackMetric("rebuffer", { duration_ms: now - bufferingAt });
      bufferingAt = null;
      setStatus("playing");
    };
    const pause = () => {
      if (!terminal && started.current && !video.error) {
        clearDeadline();
        bufferingAt = null;
        setStatus("paused");
      }
    };
    const nativeError = () => {
      if (disposed || terminal || instance) return;
      if (video.error?.code === 2 && networkRetries < 2) {
        position = video.currentTime || position;
        networkRetries += 1;
        setStatus("loading");
        armDeadline();
        clearTimeout(recovery);
        recovery = setTimeout(() => { if (!disposed) { video.load(); play(); } }, networkRetries * 500);
      } else fail(video.error?.code === 4 ? 4 : 3);
    };
    const flush = () => { if (started.current) progressRef.current?.(video.currentTime, video.duration, true); };
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    video.addEventListener("loadedmetadata", restore);
    video.addEventListener("waiting", waiting);
    video.addEventListener("stalled", waiting);
    video.addEventListener("playing", playing);
    video.addEventListener("play", armDeadline);
    video.addEventListener("pause", pause);
    video.addEventListener("error", nativeError);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);

    if (withCredentials) video.crossOrigin = "use-credentials";
    else video.removeAttribute("crossorigin");
    const isHls = sourceType === "hls" || (sourceType !== "progressive" && /\.m3u8(?:[?#]|$)/i.test(src));
    armDeadline();
    if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      play();
    } else {
      void import("hls.js").then(({ default: HlsPlayer }) => {
        if (disposed || terminal) return;
        if (!HlsPlayer.isSupported()) { fail(4); return; }
        instance = new HlsPlayer({ debug: false, enableWorker: true, startLevel: -1, xhrSetup: (xhr) => { xhr.withCredentials = withCredentials; } });
        hlsRef.current = instance;
        instance.on(HlsPlayer.Events.MANIFEST_PARSED, () => {
          if (disposed || terminal || !instance) return;
          setQualities(instance.levels.map((level, index) => ({ index, height: level.height, bitrate: level.bitrate })));
          play();
        });
        instance.on(HlsPlayer.Events.LEVEL_SWITCHED, (_event, data) => {
          const level = instance?.levels[data.level];
          if (level && !disposed) playbackMetric("quality", { level: data.level, height: level.height, bitrate: level.bitrate, automatic: instance?.autoLevelEnabled ? 1 : 0 });
        });
        instance.on(HlsPlayer.Events.ERROR, (_event, data) => {
          if (!data.fatal || disposed || terminal || !instance) return;
          if (data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
            networkRetries += 1;
            instance.stopLoad();
            setStatus("buffering");
            armDeadline();
            clearTimeout(recovery);
            recovery = setTimeout(() => { if (!disposed && !terminal) instance?.startLoad(); }, networkRetries * 500);
          } else if (data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR && mediaRetries < 1) {
            mediaRetries += 1;
            armDeadline();
            instance.recoverMediaError();
          } else fail(data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR ? 2 : 3);
        });
        instance.loadSource(src);
        instance.attachMedia(video);
      }).catch(() => fail(4));
    }

    return () => {
      disposed = true;
      clearDeadline();
      clearTimeout(recovery);
      if (started.current) finalProgress?.(video.currentTime, video.duration, true);
      started.current = false;
      playRef.current = null;
      video.removeEventListener("loadedmetadata", restore);
      video.removeEventListener("waiting", waiting);
      video.removeEventListener("stalled", waiting);
      video.removeEventListener("playing", playing);
      video.removeEventListener("play", armDeadline);
      video.removeEventListener("pause", pause);
      video.removeEventListener("error", nativeError);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
      instance?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, withCredentials, sourceType, attempt]);

  const keyboard = (event: KeyboardEvent<HTMLVideoElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const video = event.currentTarget;
    const key = event.key.toLowerCase();
    if (key === " " || key === "k") {
      event.preventDefault();
      if (video.paused) playRef.current?.();
      else video.pause();
    } else if (key === "arrowleft" || key === "arrowright") {
      event.preventDefault();
      if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + (key === "arrowleft" ? -5 : 5)));
    } else if (key === "m") {
      event.preventDefault();
      video.muted = !video.muted;
    } else if (key === "f") {
      event.preventDefault();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      else void video.parentElement?.requestFullscreen?.().catch(() => {});
    }
  };

  const retry = () => {
    const video = videoRef.current;
    if (!video) return;
    if (status === "blocked") {
      setStatus("loading");
      playRef.current?.();
    } else {
      retryPosition.current = { src, position: video.currentTime || startRef.current };
      setAttempt((value) => value + 1);
    }
  };

  return <>
    <video ref={videoRef} className="h-full w-full object-contain" controls playsInline preload="metadata" tabIndex={0} aria-label="Video player" onKeyDown={keyboard}
      onTimeUpdate={(event) => onProgress?.(event.currentTarget.currentTime, event.currentTarget.duration)}
      onPause={(event) => { if (started.current) onProgress?.(event.currentTarget.currentTime, event.currentTarget.duration, true); }}
      onEnded={(event) => { onProgress?.(event.currentTarget.duration, event.currentTarget.duration, true); setStatus("paused"); onEnded(); }}
      onPlay={() => { started.current = true; onPlay(); }}>Your browser does not support video playback.</video>
    {qualities.length > 1 && <label className="absolute left-3 top-3 z-10 rounded-md bg-neutral-950/85 text-xs text-white">
      <span className="sr-only">Video quality</span>
      <select aria-label="Video quality" value={quality} className="min-h-9 max-w-36 rounded-md border border-white/20 bg-neutral-950 px-2" onChange={(event) => {
        const level = Number(event.target.value);
        setQuality(level);
        if (hlsRef.current) hlsRef.current.currentLevel = level;
      }}>
        <option value={-1}>Quality: Auto</option>
        {qualities.map((level) => <option key={level.index} value={level.index}>{level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`}</option>)}
      </select>
    </label>}
    {status !== "playing" && status !== "paused" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 text-center text-sm text-white" role="status">
      {status === "error" || status === "blocked" ? <div className="px-4">
        {status === "error" && <p className="mb-3">Video could not load. Check your connection and try again.</p>}
        <button type="button" className="pointer-events-auto min-h-11 rounded-md bg-white px-5 py-2 font-semibold text-black" onClick={retry}>{status === "error" ? "Retry video" : "Play video"}</button>
      </div> : status === "buffering" ? "Buffering video…" : "Loading video…"}
    </div>}
  </>;
}
