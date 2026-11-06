"use client";

import { SafeImage } from '@/components/SafeImage';
import type { Program } from '@/types';
import { playbackDestination } from '@/lib/auth-return';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultHeroSettings, type HeroSettings } from '@/hooks/useHeroSettings';
import { HeroTrailer } from './HeroTrailer';

export function HomeHero({ titles, loading = false, settings = defaultHeroSettings }: { titles: Program[]; loading?: boolean; settings?: HeroSettings }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<'thumbnail' | 'trailer'>('thumbnail');
  const [requested, setRequested] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const activeRef = useRef(active);
  const requestedRef = useRef<number | null>(null);
  const readyRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  activeRef.current = active;
  const commit = useCallback((index: number) => {
    requestedRef.current = null;
    setRequested(null);
    activeRef.current = index;
    setActive(index);
    setPhase('thumbnail');
    setCycle(value => value + 1);
  }, []);
  const select = useCallback((index: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('thumbnail');
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
    if (paused || !visible || !titles.length || requested !== null) return;
    const current = titles[active];
    const showTrailer = settings.display_mode === 'thumbnail_trailer' && Boolean(current?.trailer_link);
    if (titles.length === 1 && !showTrailer) return;
    const duration = phase === 'thumbnail' ? settings.image_duration_seconds : settings.trailer_preview_seconds;
    const timer = setTimeout(() => {
      if (phase === 'thumbnail' && showTrailer) setPhase('trailer');
      else advance();
    }, Math.max(1, duration) * 1000);
    timerRef.current = timer;
    return () => { clearTimeout(timer); if (timerRef.current === timer) timerRef.current = null; };
  }, [active, advance, cycle, paused, phase, requested, settings, titles, visible]);
  if (!titles.length) return <section className="home-hero-fallback home-hero-slide relative bg-neutral-950" aria-label="Featured content" aria-busy={loading}>
    <div className={`hero-copy ${loading ? 'animate-pulse' : ''}`}><h1 className="text-4xl font-bold text-white md:text-6xl">CBM TV</h1><p className="mt-4 text-white/75">{loading ? 'Loading featured content...' : 'Explore movies, TV shows and channels.'}</p>
      {!loading && <Link href="/programs" className="hero-primary-action mt-6 inline-flex rounded-lg bg-teal-500 px-6 py-3 font-semibold text-black">Browse content</Link>}</div>
  </section>;
  const title = titles[active] ?? titles[0];
  const showTrailer = phase === 'trailer' && visible && !paused && Boolean(title.trailer_link);
  return <section className="home-hero group relative bg-black" aria-label="Featured content" aria-roledescription="carousel">
    <div className="hero-stage">
      {titles.map((item, index) => <div key={item.id} className={`home-hero-slide hero-media-slide ${index === active ? 'is-active' : ''}`} aria-hidden="true">
        <div className="hero-artwork"><div className="hero-artwork-image"><SafeImage fill src={item.backdrop || item.thumbnail} alt="" className="object-cover" sizes="(min-width: 1024px) 58vw, 100vw" priority={index === 0} loading={index === 0 || index === active || index === requested || index === (active + 1) % titles.length ? 'eager' : 'lazy'} onLoad={() => {
          readyRef.current.add(`${item.id}:${item.backdrop || item.thumbnail}`);
          if (requestedRef.current === index) commit(index);
        }} /></div>
          {index === active && showTrailer && <HeroTrailer key={item.id} url={item.trailer_link!} onEnded={() => { if (activeRef.current === index && requestedRef.current === null) advance(); }} onError={() => { if (activeRef.current === index && requestedRef.current === null) advance(); }} />}
        </div>
      </div>)}
      <div className="hero-shade-horizontal pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" /><div className="hero-shade-vertical pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
      <div key={title.id} className="hero-copy"><span className="hero-eyebrow text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Featured on CBM TV</span><h1 className="hero-title"><Link href={`/programs/${title.id}`}>{title.title}</Link></h1>
        <p className="hero-metadata mt-3 text-xs text-white/75 sm:text-sm">{[title.category?.replaceAll('_', ' ') || title.content_type, title.genre, title.duration, title.country].filter(Boolean).join(' · ')}</p><p className="hero-description mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80 md:line-clamp-3 md:text-base">{title.description}</p>
        <div className="hero-actions mt-4 flex flex-wrap gap-3"><Link href={playbackDestination(title.id)} className="hero-primary-action primary-action"><Play size={17} fill="currentColor" />Watch Now</Link></div>
      </div>
    </div>
    {titles.length > 1 && <>
      <button type="button" aria-label={paused ? 'Resume featured carousel' : 'Pause featured carousel'} onClick={() => setPaused((value) => !value)} className="hero-playback-control absolute bottom-4 left-4 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white">{paused ? <Play size={17} /> : <Pause size={17} />}</button>
      <button type="button" onClick={() => select((active - 1 + titles.length) % titles.length)} aria-label="Previous featured slide" className="hero-slide-prev absolute right-16 bottom-4 z-20 hidden size-11 items-center justify-center rounded-full bg-black/50 text-white md:flex"><ChevronLeft /></button>
      <button type="button" onClick={advance} aria-label="Next featured slide" className="hero-slide-next absolute right-4 bottom-4 z-20 hidden size-11 items-center justify-center rounded-full bg-black/50 text-white md:flex"><ChevronRight /></button>
      <div className="hero-pagination h-scroll" aria-label="Choose featured slide">{titles.map((item, index) => <button key={item.id} type="button" onClick={() => select(index)} aria-label={`Show featured slide ${index + 1}`} aria-current={index === active ? 'true' : undefined} className="flex size-11 shrink-0 items-center justify-center rounded-full"><span className={`h-1.5 rounded-full ${index === active ? 'w-7 bg-white' : 'w-1.5 bg-white/50'}`} /></button>)}</div>
    </>}
  </section>;
}
