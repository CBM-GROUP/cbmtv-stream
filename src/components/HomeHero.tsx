"use client";

import { SafeImage } from '@/components/SafeImage';
import type { Program } from '@/types';
import { playbackDestination } from '@/lib/auth-return';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultHeroSettings, type HeroSettings } from '@/hooks/useHeroSettings';
import { HeroTrailer } from './HeroTrailer';

export function HomeHero({ titles, loading = false, settings = defaultHeroSettings }: { titles: Program[]; loading?: boolean; settings?: HeroSettings }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<'thumbnail' | 'trailer'>('thumbnail');
  const [requested, setRequested] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const [failedTrailer, setFailedTrailer] = useState<number | null>(null);
  const activeRef = useRef(active);
  const requestedRef = useRef<number | null>(null);
  const readyRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timingRef = useRef({ key: '', remaining: 0 });
  activeRef.current = active;
  const commit = useCallback((index: number) => {
    requestedRef.current = null;
    setRequested(null);
    activeRef.current = index;
    setActive(index);
    setPhase('thumbnail');
    setFailedTrailer(null);
    setCycle(value => value + 1);
  }, []);
  const select = useCallback((index: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const item = titles[index];
    if (!item) return;
    const mediaKey = `${item.id}:${item.backdrop || item.thumbnail}`;
    if (index === activeRef.current || readyRef.current.has(mediaKey)) commit(index);
    else { requestedRef.current = index; setRequested(index); }
  }, [commit, titles]);
  const advance = useCallback(() => {
    if (titles.length > 1) select((activeRef.current + 1) % titles.length);
    else setPhase('thumbnail');
  }, [select, titles.length]);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPaused(motion.matches);
    const onMotion = () => setPaused(motion.matches);
    motion.addEventListener('change', onMotion);
    return () => motion.removeEventListener('change', onMotion);
  }, []);
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    onVisibility(); document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (active >= titles.length && titles.length) commit(0);
  }, [active, commit, titles]);
  useEffect(() => {
    if (settings.display_mode === 'thumbnails_only' && phase === 'trailer') setPhase('thumbnail');
  }, [phase, settings.display_mode]);
  useEffect(() => {
    if (requested === null) return;
    const timeout = setTimeout(() => {
      if (requestedRef.current === requested) commit(requested);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [commit, requested]);
  useEffect(() => {
    if (!titles.length) return;
    const current = titles[active];
    const showTrailer = settings.display_mode === 'thumbnail_trailer' && Boolean(current?.trailer_link) && failedTrailer !== current?.id;
    if (titles.length === 1 && !showTrailer) return;
    const effectivePhase = phase === 'trailer' && showTrailer ? 'trailer' : 'thumbnail';
    const duration = effectivePhase === 'thumbnail' ? settings.image_duration_seconds : settings.trailer_preview_seconds;
    const key = `${current?.id}:${cycle}:${effectivePhase}:${duration}:${settings.display_mode}:${failedTrailer}`;
    if (timingRef.current.key !== key) timingRef.current = { key, remaining: Math.max(1, duration) * 1000 };
    if (paused || !visible || requested !== null) return;
    const started = Date.now();
    const timer = setTimeout(() => {
      timingRef.current.remaining = 0;
      if (effectivePhase === 'thumbnail' && showTrailer) setPhase('trailer');
      else advance();
    }, timingRef.current.remaining);
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (timerRef.current === timer) timerRef.current = null;
      if (timingRef.current.key === key) timingRef.current.remaining = Math.max(0, timingRef.current.remaining - (Date.now() - started));
    };
  }, [active, advance, cycle, failedTrailer, paused, phase, requested, settings.display_mode, settings.image_duration_seconds, settings.trailer_preview_seconds, titles, visible]);
  if (!titles.length) return <section className="home-hero-fallback home-hero-slide relative bg-neutral-950" aria-label="Featured content" aria-busy={loading}>
    <div className={`hero-copy ${loading ? 'animate-pulse' : ''}`}><h1 className="text-4xl font-bold text-white md:text-6xl">CBM TV</h1><p className="mt-4 text-white/75">{loading ? 'Loading featured content...' : 'Explore movies, TV shows and channels.'}</p>
      {!loading && <Link href="/programs" className="hero-primary-action mt-6 inline-flex rounded-lg bg-teal-500 px-6 py-3 font-semibold text-black">Browse content</Link>}</div>
  </section>;
  const title = titles[active] ?? titles[0];
  const hasTrailer = settings.display_mode === 'thumbnail_trailer' && failedTrailer !== title.id && Boolean(title.trailer_link);
  const showTrailer = phase === 'trailer' && settings.display_mode === 'thumbnail_trailer' && failedTrailer !== title.id && Boolean(title.trailer_link);
  return <section className="home-hero group relative bg-black" data-has-video={hasTrailer} aria-label="Featured content" aria-roledescription="carousel">
    <div className="hero-stage">
      {titles.map((item, index) => <div key={item.id} className={`home-hero-slide hero-media-slide ${index === active ? 'is-active' : ''}`} aria-hidden="true">
        <div className="hero-artwork"><div className="hero-artwork-image"><SafeImage fill src={item.backdrop || item.thumbnail} alt="" className="object-cover" sizes="(min-width: 1024px) 65vw, 100vw" priority={index === 0} loading={index === 0 || index === active || index === requested || index === (active + 1) % titles.length ? 'eager' : 'lazy'} onLoad={() => {
          readyRef.current.add(`${item.id}:${item.backdrop || item.thumbnail}`);
          if (requestedRef.current === index) commit(index);
        }} /></div>
          {index === active && showTrailer && <HeroTrailer key={item.id} url={item.trailer_link!} paused={paused || !visible || requested !== null} muted={!soundEnabled} onEnded={() => { if (activeRef.current === index && requestedRef.current === null) advance(); }} onError={() => { if (activeRef.current === index) { setFailedTrailer(item.id); setPhase('thumbnail'); } }} />}
        </div>
      </div>)}
      <div className="hero-shade-horizontal pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" /><div className="hero-shade-vertical pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
      {titles.map((item, index) => <div key={item.id} className={`hero-copy ${index === active ? 'is-active' : ''}`} aria-hidden={index !== active}>
        <span className="hero-eyebrow text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Featured on CBM TV</span><h1 className="hero-title"><Link href={`/programs/${item.id}`} tabIndex={index === active ? 0 : -1}>{item.title}</Link></h1>
        <p className="hero-metadata mt-3 text-xs text-white/75 sm:text-sm">{[item.category?.replaceAll('_', ' ') || item.content_type, item.genre, item.duration, item.country].filter(Boolean).join(' · ')}</p><p className="hero-description mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80 md:line-clamp-3 md:text-base">{item.description}</p>
        <div className="hero-actions mt-4 flex flex-wrap gap-3"><Link href={playbackDestination(item.id)} tabIndex={index === active ? 0 : -1} className="hero-primary-action primary-action"><Play size={17} fill="currentColor" />Watch Now</Link></div>
      </div>)}
    </div>
    {titles.length > 1 && <>
      <button type="button" aria-label={paused ? 'Resume featured carousel' : 'Pause featured carousel'} onClick={() => setPaused((value) => !value)} className="hero-playback-control absolute bottom-4 left-4 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white">{paused ? <Play size={17} /> : <Pause size={17} />}</button>
      <button type="button" onClick={() => select((active - 1 + titles.length) % titles.length)} aria-label="Previous featured slide" className="hero-slide-prev absolute right-16 bottom-4 z-20 hidden size-11 items-center justify-center rounded-full bg-black/50 text-white md:flex"><ChevronLeft /></button>
      <button type="button" onClick={advance} aria-label="Next featured slide" className="hero-slide-next absolute right-4 bottom-4 z-20 hidden size-11 items-center justify-center rounded-full bg-black/50 text-white md:flex"><ChevronRight /></button>
      <div className="hero-pagination h-scroll" aria-label="Choose featured slide">{titles.map((item, index) => <button key={item.id} type="button" onClick={() => select(index)} aria-label={`Show featured slide ${index + 1}`} aria-current={index === active ? 'true' : undefined} className="flex shrink-0 items-center justify-center rounded-full"><span className={`h-1.5 rounded-full ${index === active ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} /></button>)}</div>
    </>}
    {hasTrailer && <button type="button" aria-label={soundEnabled ? 'Mute trailer' : 'Unmute trailer'} onClick={() => setSoundEnabled(value => !value)} className="hero-audio-control absolute bottom-4 right-4 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white">{soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>}
  </section>;
}
