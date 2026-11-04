"use client";

import { useEffect, useRef, useState } from "react";

export function TrackedVideo({ src, onEnded, onPlay, startSeconds = 0, onProgress }: {
  src: string;
  onEnded: () => void;
  onPlay: () => void;
  startSeconds?: number;
  onProgress?: (position: number, duration: number, force?: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const started = useRef(false);
  const [status, setStatus] = useState<"loading" | "buffering" | "blocked" | "error" | "playing">("loading");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => setStatus("buffering");
    const onPlaying = () => setStatus("playing");
    const onError = () => setStatus("error");

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    void video.play().catch((error: DOMException) => {
      if (error.name === "NotAllowedError") setStatus("blocked");
      else if (error.name !== "AbortError") setStatus("error");
    });
    return () => {
      if (started.current) progressRef.current?.(video.currentTime, video.duration, true);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
    };
  }, [src]);

  return <>
    <video ref={videoRef} className="h-full w-full object-contain" src={src} controls playsInline preload="metadata"
      onLoadedMetadata={(event) => { const video = event.currentTarget; if (startSeconds > 0) video.currentTime = Math.min(startSeconds, Math.max(0, video.duration - 1)); }}
      onTimeUpdate={(event) => onProgress?.(event.currentTarget.currentTime, event.currentTarget.duration)}
      onPause={(event) => onProgress?.(event.currentTarget.currentTime, event.currentTarget.duration, true)}
      onEnded={(event) => { onProgress?.(event.currentTarget.duration, event.currentTarget.duration, true); onEnded(); }} onPlay={() => { started.current = true; onPlay(); }}>Your browser does not support video playback.</video>
    {status !== "playing" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 text-center text-sm text-white" role="status">
      {status === "error" || status === "blocked" ? (
        <button
          type="button"
          className="pointer-events-auto rounded-md bg-white px-5 py-2 font-semibold text-black"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (status === "error") video.load();
            setStatus("loading");
            void video.play().catch((error: DOMException) => setStatus(error.name === "NotAllowedError" ? "blocked" : "error"));
          }}
        >{status === "error" ? "Retry video" : "Play video"}</button>
      ) : status === "buffering" ? "Buffering video…" : "Loading video…"}
    </div>}
  </>;
}
