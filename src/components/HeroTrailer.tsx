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

export function HeroTrailer({ url, onEnded, onError }: { url: string; onEnded: () => void; onError: () => void }) {
  const source = trailerSource(url);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<HTMLDivElement>(null);
  const endedRef = useRef(onEnded);
  const errorRef = useRef(onError);
  endedRef.current = onEnded;
  errorRef.current = onError;
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
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
              onReady: () => { if (!disposed) { player?.mute(); player?.playVideo(); } },
              onStateChange: ({ data }) => { if (!disposed) { if (data === 1) setPlaying(true); if (data === 0) endedRef.current(); } },
              onAutoplayBlocked: fail,
              onError: fail,
            },
          });
        } catch { fail(); }
      }).catch(fail);
      return () => { disposed = true; player?.destroy(); mount.replaceChildren(); };
    }

    const video = videoRef.current;
    if (!video) return;
    const play = () => { void video.play().catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) fail(); }); };
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
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, source.kind, source.videoId]);

  return <div className={`hero-trailer absolute inset-0 ${playing ? 'is-playing' : ''}`}>
    {source.kind === 'youtube' ? <div ref={youtubeRef} className="h-full w-full" /> : <video ref={videoRef} className="h-full w-full object-cover" muted playsInline preload="none" onPlaying={() => setPlaying(true)} onEnded={() => endedRef.current()} onError={() => errorRef.current()} />}
  </div>;
}
