"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { SafeImage } from "./SafeImage";

export type MediaControls = { play: () => void; pause: () => void };
type Status = "loading" | "buffering" | "ready" | "playing" | "paused" | "blocked" | "interrupted" | "error";

export function TrackedVideo({ src, session = 0, resumeAt = 0, poster, title, onEnded, onPlay, onFailure, onPlaybackChange, onSample, onControls }: {
  src: string;
  session?: number;
  resumeAt?: number;
  poster?: string | null;
  title?: string;
  onEnded: () => void;
  onPlay?: () => void;
  onFailure?: () => void;
  onPlaybackChange?: (playing: boolean) => void;
  onSample?: (position: number, duration: number, urgent?: boolean, ended?: boolean) => void;
  onControls?: (controls: MediaControls | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorCode, setErrorCode] = useState(0);
  const [hasFrame, setHasFrame] = useState(false);
  const source = useRef({ src, session }); source.current = { src, session };
  const callbacks = useRef({ onEnded, onPlay, onFailure, onPlaybackChange, onSample, onControls });
  callbacks.current = { onEnded, onPlay, onFailure, onPlaybackChange, onSample, onControls };
  const retryRef = useRef<() => void>(() => {});
  const automaticAttempt = useRef<{ src: string; session: number; promise: Promise<void> } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false, resumed = false, failed = false, timedOut = false, watched = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const expectedUrl = new URL(src, window.location.href).href;
    const current = () => !cancelled && source.current.src === src && source.current.session === session && (!video.currentSrc || video.currentSrc === expectedUrl);
    const clear = () => { clearTimeout(deadline); deadline = undefined; };
    const wait = () => { if (!deadline && !timedOut) deadline = setTimeout(() => { deadline = undefined; if (current() && !video.paused) { timedOut = true; setStatus("interrupted"); } }, 15000); };
    const sample = (urgent = false, ended = false) => { if (current() && watched) callbacks.current.onSample?.(video.currentTime, video.duration, urgent, ended); };
    const failure = (code?: number) => {
      if (!current() || failed) return;
      failed = true; clear(); setErrorCode(code ?? video.error?.code ?? 0); setStatus("error");
      callbacks.current.onPlaybackChange?.(false); callbacks.current.onFailure?.();
    };
    const resume = () => {
      if (resumed || !current() || video.readyState < 1) return;
      resumed = true;
      const position = Number.isFinite(resumeAt) && resumeAt > 0 && (!Number.isFinite(video.duration) || resumeAt < video.duration * .95) ? resumeAt : 0;
      if (Math.abs(video.currentTime - position) > .25) video.currentTime = position;
    };
    const play = (automatic = false) => {
      // currentSrc can still name the previous resource immediately after React
      // sets src. Commands target the new session; events require the URL guard.
      if (cancelled || source.current.src !== src || source.current.session !== session) return;
      if (!video.paused && video.readyState >= 3 && video.videoWidth > 0) { watched = true; clear(); setHasFrame(true); setStatus("playing"); callbacks.current.onPlaybackChange?.(true); return; }
      setStatus("loading"); wait();
      const previous = automaticAttempt.current;
      const promise = automatic && previous?.src === src && previous.session === session ? previous.promise : video.play();
      if (automatic) automaticAttempt.current = { src, session, promise };
      void promise.catch((error: DOMException) => {
        if (!current() || error.name === "AbortError") return;
        if (error.name === "NotAllowedError") { clear(); setStatus("blocked"); }
        else failure();
      });
    };
    const playing = () => { if (current()) {
      // Some browsers accept an MP4's audio while silently dropping its video
      // codec. Do not present a black screen as successful video playback.
      if (!video.videoWidth || !video.videoHeight) { video.pause(); failure(4); return; }
      watched = true; timedOut = false; clear(); setHasFrame(true); setStatus("playing"); callbacks.current.onPlaybackChange?.(true); callbacks.current.onPlay?.();
    } };
    const waiting = () => { if (current() && !video.paused && !timedOut) { setStatus("buffering"); wait(); } };
    const paused = () => { if (current()) { clear(); setStatus((previous) => previous === "blocked" || previous === "error" ? previous : "paused"); callbacks.current.onPlaybackChange?.(false); sample(true); } };
    const ended = () => { if (current() && video.ended) { clear(); sample(true, true); setStatus("paused"); callbacks.current.onPlaybackChange?.(false); callbacks.current.onEnded(); } };
    const nativeError = () => { if (video.error) failure(); };
    const ready = () => { resume(); if (current() && video.paused) setStatus((previous) => previous === "loading" || previous === "buffering" ? "ready" : previous); };
    const update = () => sample();
    const sought = () => sample(true);
    video.addEventListener("loadedmetadata", resume);
    video.addEventListener("canplay", ready);
    video.addEventListener("playing", playing);
    video.addEventListener("waiting", waiting);
    video.addEventListener("stalled", waiting);
    video.addEventListener("pause", paused);
    video.addEventListener("ended", ended);
    video.addEventListener("error", nativeError);
    video.addEventListener("timeupdate", update);
    video.addEventListener("seeked", sought);
    setErrorCode(0); setHasFrame(false); setStatus("loading"); callbacks.current.onPlaybackChange?.(false);
    callbacks.current.onControls?.({ play, pause: () => video.pause() });
    retryRef.current = () => {
      if (!current()) return;
      failed = false; timedOut = false; setErrorCode(0);
      // Only a failed source needs a reload. A stalled source retains its place.
      if (video.error) { const position = video.currentTime; video.load(); resumed = position > 0; if (position > 0) video.addEventListener("loadedmetadata", () => { if (current()) video.currentTime = Math.min(position, video.duration || position); }, { once: true }); }
      play();
    };
    resume();
    if (video.error && current()) failure(); else play(true);
    return () => {
      cancelled = true; clear();
      video.removeEventListener("loadedmetadata", resume);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("playing", playing);
      video.removeEventListener("waiting", waiting);
      video.removeEventListener("stalled", waiting);
      video.removeEventListener("pause", paused);
      video.removeEventListener("ended", ended);
      video.removeEventListener("error", nativeError);
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("seeked", sought);
    };
    // Callback refs keep layout, progress-cache and options updates from reloading media.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, session]);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      callbacks.current.onControls?.(null);
      // React's development effect replay retains this DOM node. Release the
      // source only after a real detach, otherwise that replay clears playback.
      queueMicrotask(() => { if (video && !video.isConnected) { video.pause(); video.removeAttribute("src"); video.load(); } });
    };
  }, []);

  const busy = status === "loading" || status === "buffering";
  const actionable = status === "blocked" || status === "ready" || status === "interrupted" || status === "error";
  return <>
    <video ref={videoRef} className="h-full w-full object-contain" src={src} controls={status !== "error"} playsInline preload="metadata" tabIndex={0} aria-label={title ? `${title} video player` : "Video player"}>Your browser does not support video playback.</video>
    {(busy || actionable) && <div className="player-feedback" role={status === "error" ? "alert" : "status"}>
      {!hasFrame && poster && <SafeImage src={poster} alt="" fill className="pointer-events-none object-contain opacity-25" sizes="(min-width: 1200px) 64vw, 92vw" />}
      <div className="relative max-w-sm rounded-lg bg-black/75 px-5 py-4 text-center text-sm text-white">
        {busy ? <><LoaderCircle size={22} className="mx-auto mb-2 animate-spin text-teal-300" /><p>{status === "buffering" ? "Buffering video…" : "Preparing video…"}</p></> : <>
          {status === "error" && <p className="mb-3 text-white/80">{errorCode === 3 || errorCode === 4 ? "This video could not be decoded in your browser." : "The video couldn’t be loaded. Check your connection and try again."}</p>}
          {status === "interrupted" && <p className="mb-3 text-white/80">Playback is taking longer than expected. Try again when your connection is ready.</p>}
          {status === "blocked" && <p className="mb-3 text-white/80">Press Play to start the video.</p>}
          <button type="button" className="primary-action pointer-events-auto" onClick={() => retryRef.current()}>{status === "error" || status === "interrupted" ? "Retry video" : "Play video"}</button>
        </>}
      </div>
    </div>}
  </>;
}
