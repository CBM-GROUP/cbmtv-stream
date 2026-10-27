"use client";

import { SafeImage } from "@/components/SafeImage";
import type { Advert, Program } from "@/types";
import { playbackDestination } from "@/lib/auth-return";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Play, Pause } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  slides: Advert[];
  imageDurationSeconds: number;
  featured?: Program;
};

export function HomeHero({ slides: adverts, imageDurationSeconds, featured }: Props) {
  const slides = useMemo(() => adverts.length ? adverts : featured ? [{
    id: featured.id, advert_type: "hello" as const, advert_name: featured.title,
    advert_description: featured.description, advert_thumbnail: featured.thumbnail,
    advert_link: `/programs/${featured.id}`, stream_link: null,
  }] : [], [adverts, featured]);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: slides.length > 1 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const imageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setPaused(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);

  const clearTimer = useCallback(() => {
    if (imageTimer.current) clearTimeout(imageTimer.current);
    imageTimer.current = null;
  }, []);

  const advance = useCallback(() => {
    if (slides.length > 1) emblaApi?.scrollNext();
  }, [emblaApi, slides.length]);

  useEffect(() => {
    if (!emblaApi) return;
    const syncIndex = () => setActiveIndex(emblaApi.selectedScrollSnap());
    syncIndex();
    emblaApi.on("select", syncIndex);
    emblaApi.on("reInit", syncIndex);
    return () => {
      emblaApi.off("select", syncIndex);
      emblaApi.off("reInit", syncIndex);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    let cancelled = false;
    clearTimer();
    videoRefs.current.forEach((video, index) => {
      if (index !== activeIndex || paused) video?.pause();
    });
    if (paused) return;

    const slide = slides[activeIndex];
    if (!slide) return;
    const duration = Math.max(5, Math.min(120, imageDurationSeconds)) * 1000;

    if (slide.stream_link) {
      const video = videoRefs.current[activeIndex];
      if (video) {
        video.currentTime = 0;
        void video.play().catch(() => {
          // If autoplay is blocked, leave the poster on screen for one image interval.
          if (!cancelled && slides.length > 1) imageTimer.current = setTimeout(advance, duration);
        });
      }
    } else if (slides.length > 1) {
      imageTimer.current = setTimeout(advance, duration);
    }

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [activeIndex, advance, clearTimer, emblaApi, imageDurationSeconds, slides, paused]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (video) video.muted = muted;
    });
  }, [muted]);

  if (slides.length === 0) {
    return (
      <section className="home-hero-slide relative bg-neutral-950" aria-label="Featured content">
        <div className="hero-copy">
          <h1 className="text-4xl font-bold text-white md:text-6xl">CBM TV</h1>
          <p className="mt-4 text-white/75">Explore movies, series and channels.</p>
          <Link href="/programs" className="mt-6 inline-flex rounded-lg bg-teal-500 px-6 py-3 font-semibold text-black">Browse content</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="group relative bg-black" aria-label="Featured content" aria-roledescription="carousel">
      <div className="embla" ref={emblaRef}>
        <div className="embla__container">
          {slides.map((slide, index) => (
            <div className="embla__slide home-hero-slide relative shrink-0 overflow-hidden bg-black" key={slide.id} aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}>
              {slide.stream_link ? (
                <video
                  ref={(element) => { videoRefs.current[index] = element; }}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={slide.stream_link}
                  poster={slide.advert_thumbnail || undefined}
                  preload={index === 0 ? "metadata" : "none"}
                  muted={muted}
                  playsInline
                  onEnded={() => { if (activeIndex === index) advance(); }}
                  onError={() => { if (activeIndex === index) advance(); }}
                />
              ) : (
                <SafeImage
                  fill
                  src={slide.advert_thumbnail}
                  alt={slide.advert_name || "Featured content"}
                  className="object-cover object-[60%_center]"
                  sizes="100vw"
                  priority={index === 0}
                  unoptimized
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
              <div className="hero-copy">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Featured on CBM TV</span>
                <h1 className="hero-title">{slide.advert_name || "Featured content"}</h1>
                {featured && (!adverts.length || slide.advert_link === `/programs/${featured.id}`) && <p className="mt-3 text-xs text-white/75 sm:text-sm">{[featured.content_type, featured.genre, featured.duration, featured.country].filter(Boolean).join(" · ")}</p>}
                {slide.advert_description && (
                  <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80 md:line-clamp-3 md:text-base">{slide.advert_description}</p>
                )}
                {slide.advert_link && /^(https?:\/\/|\/(?!\/))/.test(slide.advert_link) && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={/^\/programs\/[1-9]\d*\/?$/.test(slide.advert_link) ? playbackDestination(Number(slide.advert_link.split("/")[2])) : slide.advert_link} className="primary-action">
                      <Play size={17} fill="currentColor" />{/^\/programs\/[1-9]\d*\/?$/.test(slide.advert_link) ? "Watch Now" : "Explore"}
                    </Link>
                    {/^\/programs\/[1-9]\d*\/?$/.test(slide.advert_link) && <Link href={slide.advert_link} className="inline-flex min-h-11 items-center rounded-md bg-white/15 px-4 text-sm font-medium hover:bg-white/25">More info</Link>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides[activeIndex]?.stream_link && (
        <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute hero video" : "Mute hero video"} className="absolute bottom-4 left-16 z-20 rounded-full bg-black/60 p-3 text-white hover:bg-black/80">
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
      )}

      {(slides.length > 1 || slides[activeIndex]?.stream_link) && <button type="button" aria-label={paused ? "Resume featured carousel" : "Pause featured carousel"} onClick={() => setPaused((value) => !value)} className="absolute bottom-4 left-4 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white">{paused ? <Play size={17} /> : <Pause size={17} />}</button>}

      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => emblaApi?.scrollPrev()} aria-label="Previous featured slide" className="absolute right-16 bottom-4 z-20 hidden rounded-full bg-black/50 p-2 text-white hover:bg-black/80 md:block">
            <ChevronLeft size={24} />
          </button>
          <button type="button" onClick={advance} aria-label="Next featured slide" className="absolute right-4 bottom-4 z-20 hidden rounded-full bg-black/50 p-2 text-white hover:bg-black/80 md:block">
            <ChevronRight size={24} />
          </button>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2" aria-label="Choose featured slide">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => emblaApi?.scrollTo(index)}
                aria-label={`Show featured slide ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className="flex h-8 w-8 items-center justify-center rounded-full"
              ><span className={`h-1.5 rounded-full ${index === activeIndex ? "w-7 bg-white" : "w-1.5 bg-white/50"}`} /></button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
