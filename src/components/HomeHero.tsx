"use client";

import { SafeImage } from '@/components/SafeImage';
import type { Program } from '@/types';
import { playbackDestination } from '@/lib/auth-return';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultHeroSettings, type HeroSettings } from '@/hooks/useHeroSettings';
import { HeroTrailer } from './HeroTrailer';
import { SponsoredPlacement } from './SponsoredPlacement';
import { useAuth } from '@/context/AuthContext';
import { openAdSession, decideAd, type AdSession, type Advertisement } from '@/services/advertising';
import { insertFeaturedAdverts, reconcileFeaturedIndex } from '@/lib/featured-adverts';

export function HomeHero({ titles, loading = false, settings = defaultHeroSettings, insertion }: { titles: Program[]; loading?: boolean; settings?: HeroSettings; insertion?: { enabled: boolean; interval: number } }) {
  const { user } = useAuth();
  const [adverts, setAdverts] = useState(new Map<number, { session: AdSession; ad: Advertisement }>());
  const interval = insertion?.interval && Number.isInteger(insertion.interval) && insertion.interval > 0 ? insertion.interval : 3;
  const movieCount = titles.filter((title) => title.content_type === 'movie').length;
  const slides = useMemo(() => insertFeaturedAdverts(titles, insertion?.enabled ? adverts : new Map(), interval), [titles, adverts, interval, insertion?.enabled]);
  useEffect(() => {
    const controller = new AbortController();
    setAdverts(new Map());
    if (insertion?.enabled && movieCount >= interval) {
      void openAdSession({ context: 'homepage' }, user?.id, controller.signal).then(async (session) => {
        const eligible = new Map<number, { session: AdSession; ad: Advertisement }>();
        for (let after = interval; after <= movieCount && !controller.signal.aborted; after += interval) {
          const ad = await decideAd(session, 'homepage_featured_sponsor', `featured-${after}`, user?.id, controller.signal);
          if (ad?.kind === 'image') eligible.set(after, { session, ad });
        }
        if (!controller.signal.aborted) setAdverts(eligible);
      }).catch(() => {});
    }
    return () => controller.abort();
  }, [insertion?.enabled, interval, movieCount, titles, user?.id]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<'thumbnail' | 'trailer'>('thumbnail');
  const [requested, setRequested] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const [failedTrailer, setFailedTrailer] = useState<number | null>(null);
  const activeRef = useRef(active);
  const previousSlides = useRef(slides);
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
  useEffect(() => {
    const index = reconcileFeaturedIndex(previousSlides.current, slides, activeRef.current);
    previousSlides.current = slides;
    if (requestedRef.current !== null) {
      requestedRef.current = null;
      setRequested(null);
    }
    if (index !== activeRef.current) commit(index);
  }, [slides, commit]);
  const select = useCallback((index: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const item = slides[index];
    if (!item) return;
    const mediaKey = item.kind === 'movie' ? `${item.movie.id}:${item.movie.backdrop || item.movie.thumbnail}` : '';
    if (item.kind === 'advert' || index === activeRef.current || readyRef.current.has(mediaKey)) commit(index);
    else { requestedRef.current = index; setRequested(index); }
  }, [commit, slides]);
  const advance = useCallback(() => {
    if (slides.length > 1) select((activeRef.current + 1) % slides.length);
    else setPhase('thumbnail');
  }, [select, slides.length]);
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
    if (!slides.length) return;
    const current = slides[active];
    const movie = current?.kind === 'movie' ? current.movie : null;
    const showTrailer = settings.display_mode === 'thumbnail_trailer' && Boolean(movie?.trailer_link) && failedTrailer !== movie?.id;
    if (slides.length === 1 && !showTrailer) return;
    const effectivePhase = phase === 'trailer' && showTrailer ? 'trailer' : 'thumbnail';
    const duration = effectivePhase === 'thumbnail' ? settings.image_duration_seconds : settings.trailer_preview_seconds;
    const key = `${current?.kind === 'advert' ? current.ad.decision_id : movie?.id}:${cycle}:${effectivePhase}:${duration}:${settings.display_mode}:${failedTrailer}`;
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
  }, [active, advance, cycle, failedTrailer, paused, phase, requested, settings.display_mode, settings.image_duration_seconds, settings.trailer_preview_seconds, slides, visible]);
  if (!titles.length) return <section className="home-hero-fallback home-hero-slide relative bg-neutral-950" aria-label="Featured content" aria-busy={loading}>
    <div className={`hero-copy ${loading ? 'animate-pulse' : ''}`}><h1 className="text-4xl font-bold text-white md:text-6xl">CBM TV</h1><p className="mt-4 text-white/75">{loading ? 'Loading featured content...' : 'Explore movies, TV shows and channels.'}</p>
      {!loading && <Link href="/programs" className="hero-primary-action mt-6 inline-flex rounded-lg bg-teal-500 px-6 py-3 font-semibold text-black">Browse content</Link>}</div>
  </section>;
  const current = slides[active] ?? slides[0];
  const title = current.kind === 'movie' ? current.movie : null;
  const hasTrailer = Boolean(title && settings.display_mode === 'thumbnail_trailer' && failedTrailer !== title.id && title.trailer_link);
  const showTrailer = Boolean(title && phase === 'trailer' && settings.display_mode === 'thumbnail_trailer' && failedTrailer !== title.id && title.trailer_link);
  return <section className="home-hero group relative bg-black" data-has-video={hasTrailer} aria-label="Featured content" aria-roledescription="carousel">
    <div className="hero-stage">
      {slides.map((slide, index) => <div key={slide.kind === 'movie' ? `movie-${slide.movie.id}` : `advert-${slide.after}`} className={`home-hero-slide hero-media-slide ${index === active ? 'is-active' : ''}`} aria-hidden={index !== active}>
        {slide.kind === 'advert' ? index === active && <div className="flex h-full items-center justify-center bg-neutral-950 p-5"><div className="w-full max-w-3xl"><SponsoredPlacement placement="homepage_featured_sponsor" context="homepage" selection={slide} /></div></div> : <div className="hero-artwork"><div className="hero-artwork-image"><SafeImage fill src={slide.movie.backdrop || slide.movie.thumbnail} alt="" className="object-cover" sizes="(min-width: 1024px) 65vw, 100vw" priority={index === 0} loading={index === 0 || index === active || index === requested || index === (active + 1) % slides.length ? 'eager' : 'lazy'} onLoad={() => {
          readyRef.current.add(`${slide.movie.id}:${slide.movie.backdrop || slide.movie.thumbnail}`);
          if (requestedRef.current === index) commit(index);
        }} /></div>
          {index === active && showTrailer && <HeroTrailer key={slide.movie.id} url={slide.movie.trailer_link!} paused={paused || !visible || requested !== null} muted={!soundEnabled} onEnded={() => { if (activeRef.current === index && requestedRef.current === null) advance(); }} onError={() => { if (activeRef.current === index) { setFailedTrailer(slide.movie.id); setPhase('thumbnail'); } }} />}
        </div>}
      </div>)}
      <div className="hero-shade-horizontal pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" /><div className="hero-shade-vertical pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
      {slides.map((slide, index) => slide.kind === 'movie' && <div key={slide.movie.id} className={`hero-copy ${index === active ? 'is-active' : ''}`} aria-hidden={index !== active}>
        {(() => { const item = slide.movie; return <>
        <span className="hero-eyebrow text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Featured on CBM TV</span><h1 className="hero-title"><Link href={`/programs/${item.id}`} tabIndex={index === active ? 0 : -1}>{item.title}</Link></h1>
        <p className="hero-metadata mt-3 text-xs text-white/75 sm:text-sm">{[item.category?.replaceAll('_', ' ') || item.content_type, item.genre, item.duration, item.country].filter(Boolean).join(' · ')}</p><p className="hero-description mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80 md:line-clamp-3 md:text-base">{item.description}</p>
        <div className="hero-actions mt-4 flex flex-wrap gap-3"><Link href={playbackDestination(item.id)} tabIndex={index === active ? 0 : -1} className="hero-primary-action primary-action"><Play size={17} fill="currentColor" />Watch Now</Link></div>
        </>; })()}
      </div>)}
    </div>
    {slides.length > 1 && <>
      <button type="button" aria-label={paused ? 'Resume featured carousel' : 'Pause featured carousel'} onClick={() => setPaused((value) => !value)} className="hero-playback-control absolute bottom-4 left-4 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white">{paused ? <Play size={17} /> : <Pause size={17} />}</button>
      <button type="button" onClick={() => select((active - 1 + slides.length) % slides.length)} aria-label="Previous featured slide" className="hero-slide-prev absolute right-16 bottom-4 z-20 hidden size-11 items-center justify-center rounded-full bg-black/50 text-white md:flex"><ChevronLeft /></button>
      <button type="button" onClick={advance} aria-label="Next featured slide" className="hero-slide-next absolute right-4 bottom-4 z-20 hidden size-11 items-center justify-center rounded-full bg-black/50 text-white md:flex"><ChevronRight /></button>
      <div className="hero-pagination h-scroll" aria-label="Choose featured slide">{slides.map((slide, index) => <button key={slide.kind === 'movie' ? `movie-${slide.movie.id}` : `advert-${slide.after}`} type="button" onClick={() => select(index)} aria-label={slide.kind === 'advert' ? `Show sponsored slide after movie ${slide.after}` : `Show featured slide ${index + 1}`} aria-current={index === active ? 'true' : undefined} className="flex shrink-0 items-center justify-center rounded-full"><span className={`h-1.5 rounded-full ${index === active ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} /></button>)}</div>
    </>}
    {hasTrailer && <button type="button" aria-label={soundEnabled ? 'Mute trailer' : 'Unmute trailer'} onClick={() => setSoundEnabled(value => !value)} className="hero-audio-control absolute bottom-4 right-4 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white">{soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>}
  </section>;
}
