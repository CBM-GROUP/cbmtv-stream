"use client";

import { useEffect, useRef, useState } from "react";
import { checkpoint, shouldSaveCheckpoint } from "@/lib/library-playback";
import { useLibrary } from "@/context/LibraryContext";
import { useAuth } from "@/context/AuthContext";
import { saveProgressOnExit } from "@/services/library";

export type PlaybackTarget = {
  content: number;
  episode?: number | null;
  miniseries?: number | null;
  startAt?: number;
};

export function TrackedVideo({ src, target, onEnded, onPlay }: {
  src: string;
  target: PlaybackTarget | null;
  onEnded: () => void;
  onPlay: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "buffering" | "blocked" | "error" | "playing">("loading");
  const { saveProgress } = useLibrary();
  const { user } = useAuth();
  const saveRef = useRef(saveProgress);
  saveRef.current = saveProgress;
  const contentId = target?.content;
  const episodeId = target?.episode;
  const miniseriesId = target?.miniseries;
  const startAt = target?.startAt;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !contentId) return;
    const save = saveRef.current;
    const sessionToken = localStorage.getItem("access_token");
    let position = startAt ?? 0;
    let duration = 0;
    let lastSaved = -1;
    let seeked = false;
    let queue = Promise.resolve();

    const sample = () => {
      if (Number.isFinite(video.currentTime)) position = video.currentTime;
      if (Number.isFinite(video.duration) && video.duration > 0) duration = video.duration;
    };
    const flush = (force = false, exiting = false) => {
      sample();
      if (!shouldSaveCheckpoint(position, lastSaved, duration, force)) return;
      lastSaved = position;
      const data = checkpoint(contentId, position, duration, episodeId, miniseriesId);
      if (exiting) saveProgressOnExit(data, sessionToken);
      else queue = queue.then(() => save(data)).catch(() => {});
    };
    const onMetadata = () => {
      sample();
      if (!seeked && startAt && video.duration > startAt) {
        video.currentTime = startAt;
        seeked = true;
      }
    };
    const onTime = () => flush(false);
    const onPause = () => flush(true);
    const onEnd = () => { sample(); position = duration || position; flush(true); };
    const onPageHide = () => flush(true, true);
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(true, true); };
    const onWaiting = () => setStatus("buffering");
    const onPlaying = () => setStatus("playing");
    const onError = () => setStatus("error");

    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnd);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    if (video.readyState >= 1) onMetadata();
    void video.play().catch((error: DOMException) => {
      if (error.name === "NotAllowedError") setStatus("blocked");
      else if (error.name !== "AbortError") setStatus("error");
    });
    return () => {
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnd);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush(true);
    };
  }, [src, contentId, episodeId, miniseriesId, startAt, user?.id]);

  return <>
    <video ref={videoRef} className="h-full w-full object-contain" src={src} controls playsInline preload="metadata" onEnded={onEnded} onPlay={onPlay}>Your browser does not support video playback.</video>
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
