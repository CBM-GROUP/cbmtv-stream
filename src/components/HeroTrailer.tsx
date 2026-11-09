"use client";

import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { youtubeApi, type YouTubePlayer } from './TrackedYouTube';

export function trailerSource(url: string): { kind: 'youtube' | 'hls' | 'video' | 'invalid'; videoId?: string } {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return { kind: 'invalid' };
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be' || host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      const videoId = host.endsWith('youtu.be') ? parsed.pathname.slice(1) : parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
      return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? { kind: 'youtube', videoId } : { kind: 'invalid' };
    }
    return { kind: /\.m3u8$/i.test(parsed.pathname) ? 'hls' : 'video' };
  } catch { return { kind: 'invalid' }; }
}

export function HeroTrailer({ url, paused, onEnded, onError }: { url: string; paused: boolean; onEnded: () => void; onError: () => void }) {
  const source = trailerSource(url);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<HTMLDivElement>(null);
  const endedRef = useRef(onEnded);
  const errorRef = useRef(onError);
  const pausedRef = useRef(paused);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const readyRef = useRef(false);
  endedRef.current = onEnded;
  errorRef.current = onError;
  pausedRef.current = paused;
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
    readyRef.current = false;
    if (source.kind === 'invalid') { errorRef.current(); return; }
    let disposed = false;
    let failed = false;
    let player: YouTubePlayer | null = null;
    let hls: Hls | null = null;
    const fail = () => { if (!disposed && !failed) { failed = true; errorRef.current(); } };

    if (source.kind === 'youtube') {
      const mount = youtubeRef.current;
      if (!mount) return;
      const target = document.createElement('div');
      mount.replaceChildren(target);
      void youtubeApi().then((api) => {
        if (disposed) return;
        try {
          player = new api.Player(target, {
            videoId: source.videoId!, width: '100%', height: '100%',
            playerVars: { autoplay: 1, controls: 0, playsinline: 1, origin: window.location.origin },
            events: {
              onReady: () => { if (!disposed) { readyRef.current = true; playerRef.current = player; player?.mute(); if (!pausedRef.current) player?.playVideo(); } },
              onStateChange: ({ data }) => { if (!disposed) { if (data === 1) { setPlaying(true); if (pausedRef.current) player?.pauseVideo(); } if (data === 0 && !pausedRef.current) endedRef.current(); } },
              onAutoplayBlocked: fail,
              onError: fail,
            },
          });
        } catch { fail(); }
      }).catch(fail);
      return () => { disposed = true; readyRef.current = false; playerRef.current = null; player?.destroy(); mount.replaceChildren(); };
    }

    const video = videoRef.current;
    if (!video) return;
    const play = () => {
      readyRef.current = true;
      if (pausedRef.current) return;
      void video.play().catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) fail(); });
    };
    if (source.kind === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
      void import('hls.js').then(({ default: HlsPlayer }) => {
        if (disposed) return;
        if (!HlsPlayer.isSupported()) { fail(); return; }
        hls = new HlsPlayer();
        hls.on(HlsPlayer.Events.MANIFEST_PARSED, play);
        hls.on(HlsPlayer.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
        hls.loadSource(url);
        hls.attachMedia(video);
      }).catch(fail);
    } else {
      video.src = url;
      play();
    }
    return () => {
      disposed = true;
      readyRef.current = false;
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, source.kind, source.videoId]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (source.kind === 'youtube') {
      if (paused) playerRef.current?.pauseVideo();
      else playerRef.current?.playVideo();
    } else if (videoRef.current) {
      if (paused) videoRef.current.pause();
      else void videoRef.current.play().catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) errorRef.current();
      });
    }
  }, [paused, source.kind]);

  return <div className={`hero-trailer absolute inset-0 ${playing ? 'is-playing' : ''}`}>
    {source.kind === 'youtube' ? <div ref={youtubeRef} className="h-full w-full" /> : <video ref={videoRef} className="h-full w-full object-cover" muted playsInline preload="none" onPlaying={() => { setPlaying(true); if (pausedRef.current) videoRef.current?.pause(); }} onEnded={() => { if (!pausedRef.current) endedRef.current(); }} onError={() => errorRef.current()} />}
  </div>;
}
