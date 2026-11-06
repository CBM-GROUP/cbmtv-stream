"use client";

import { SafeImage } from '@/components/SafeImage';
import type { Program } from '@/types';
import { playbackDestination } from '@/lib/auth-return';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Info, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { defaultHeroSettings, type HeroSettings } from '@/hooks/useHeroSettings';

export function HomeHero({ titles, loading = false, settings = defaultHeroSettings }: { titles: Program[]; loading?: boolean; settings?: HeroSettings }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: titles.length > 1 });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<'thumbnail' | 'trailer'>('thumbnail');
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
    if (!embla) return;
    const sync = () => { setActive(embla.selectedScrollSnap()); setPhase('thumbnail'); };
    sync(); embla.on('select', sync); embla.on('reInit', sync);
    return () => { embla.off('select', sync); embla.off('reInit', sync); };
  }, [embla]);
  useEffect(() => {
    if (paused || !visible || titles.length < 2 || !embla) return;
    const current = titles[active];
    const showTrailer = settings.display_mode === 'thumbnail_trailer' && Boolean(current?.trailer_link);
    const duration = phase === 'thumbnail' ? settings.image_duration_seconds : settings.trailer_preview_seconds;
    const timer = setTimeout(() => {
      if (phase === 'thumbnail' && showTrailer) setPhase('trailer');
      else embla.scrollNext();
    }, Math.max(1, duration) * 1000);
    return () => clearTimeout(timer);
  }, [active, embla, paused, phase, settings, titles, visible]);
  if (!titles.length) return <section className="home-hero-fallback home-hero-slide relative bg-neutral-950" aria-label="Featured content" aria-busy={loading}>
    <div className={`hero-copy ${loading ? 'animate-pulse' : ''}`}><h1 className="text-4xl font-bold text-white md:text-6xl">CBM TV</h1><p className="mt-4 text-white/75">{loading ? 'Loading featured content...' : 'Explore movies, TV shows and channels.'}</p>
      {!loading && <Link href="/programs" className="hero-primary-action mt-6 inline-flex rounded-lg bg-teal-500 px-6 py-3 font-semibold text-black">Browse content</Link>}</div>
  </section>;
  return <section className="home-hero group relative bg-black" aria-label="Featured content" aria-roledescription="carousel">
    <div className="embla" ref={emblaRef}><div className="embla__container">{titles.map((title, index) => <div key={title.id} className={`embla__slide home-hero-slide relative shrink-0 overflow-hidden bg-black ${index === active ? 'hero-current-slide' : ''}`} aria-hidden={index !== active} aria-label={`${index + 1} of ${titles.length}`} aria-roledescription="slide">
      <div className="hero-artwork"><SafeImage fill src={title.backdrop || title.thumbnail} alt={title.title} className="object-cover object-[60%_center]" sizes="(min-width: 1024px) 76vw, 100vw" priority={index === 0} />{index === active && phase === 'trailer' && visible && !paused && title.trailer_link && <video key={title.id} className="hero-trailer absolute inset-0 h-full w-full object-cover" src={title.trailer_link} autoPlay muted playsInline preload="none" onEnded={() => embla?.scrollNext()} onError={() => embla?.scrollNext()} />}</div>
      <div className="hero-shade-horizontal pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" /><div className="hero-shade-vertical pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
      <div className="hero-copy"><span className="hero-eyebrow text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Featured on CBM TV</span><h1 className="hero-title"><Link href={`/programs/${title.id}`} tabIndex={index === active ? 0 : -1}>{title.title}</Link></h1>
        <p className="hero-metadata mt-3 text-xs text-white/75 sm:text-sm">{[title.category?.replaceAll('_', ' ') || title.content_type, title.genre, title.duration, title.country].filter(Boolean).join(' · ')}</p><p className="hero-description mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80 md:line-clamp-3 md:text-base">{title.description}</p>
        <div className="hero-actions mt-4 flex flex-wrap gap-3"><Link tabIndex={index === active ? 0 : -1} href={playbackDestination(title.id)} className="hero-primary-action primary-action"><Play size={17} fill="currentColor" />Watch Now</Link><Link tabIndex={index === active ? 0 : -1} href={`/programs/${title.id}`} className="hero-info-action inline-flex min-h-11 items-center rounded-md bg-white/15 px-4 text-sm font-medium hover:bg-white/25"><Info size={20} className="mr-2" />More info</Link></div>
      </div>
    </div>)}</div></div>
    {titles.length > 1 && <>
      <button type="button" aria-label={paused ? 'Resume featured carousel' : 'Pause featured carousel'} onClick={() => setPaused((value) => !value)} className="hero-playback-control absolute bottom-4 left-4 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white">{paused ? <Play size={17} /> : <Pause size={17} />}</button>
      <button type="button" onClick={() => embla?.scrollPrev()} aria-label="Previous featured slide" className="hero-slide-prev absolute right-16 bottom-4 z-20 hidden size-11 items-center justify-center rounded-full bg-black/50 text-white md:flex"><ChevronLeft /></button>
      <button type="button" onClick={() => embla?.scrollNext()} aria-label="Next featured slide" className="hero-slide-next absolute right-4 bottom-4 z-20 hidden size-11 items-center justify-center rounded-full bg-black/50 text-white md:flex"><ChevronRight /></button>
      <div className="hero-pagination h-scroll" aria-label="Choose featured slide">{titles.map((title, index) => <button key={title.id} type="button" onClick={() => embla?.scrollTo(index)} aria-label={`Show featured slide ${index + 1}`} aria-current={index === active ? 'true' : undefined} className="flex size-11 shrink-0 items-center justify-center rounded-full"><span className={`h-1.5 rounded-full ${index === active ? 'w-7 bg-white' : 'w-1.5 bg-white/50'}`} /></button>)}</div>
    </>}
  </section>;
}
