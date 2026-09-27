"use client";

import { SafeImage } from "@/components/SafeImage";
import type { Advert } from "@/types";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  slides: Advert[];
  imageDurationSeconds: number;
};

export function HomeHero({ slides, imageDurationSeconds }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: slides.length > 1 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const imageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (index !== activeIndex) video?.pause();
    });

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
  }, [activeIndex, advance, clearTimer, emblaApi, imageDurationSeconds, slides]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (video) video.muted = muted;
    });
  }, [muted]);

  if (slides.length === 0) {
    return (
      <section className="home-hero-slide flex items-end bg-neutral-950 p-8 md:p-16" aria-label="Featured content">
        <div>
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
                  className="object-cover"
                  sizes="100vw"
                  priority={index === 0}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
              <div className="absolute bottom-20 left-6 right-6 z-10 max-w-2xl text-white md:bottom-24 md:left-16">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Featured on CBM TV</span>
                <h1 className="mt-3 break-words text-5xl font-bold leading-none md:text-7xl xl:text-8xl">{slide.advert_name || "Featured content"}</h1>
                {slide.advert_description && (
                  <p className="mt-4 line-clamp-3 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">{slide.advert_description}</p>
                )}
                {slide.advert_link && (
                  <Link href={slide.advert_link} className="mt-6 inline-flex rounded-lg bg-teal-500 px-6 py-3 font-semibold text-black transition-colors hover:bg-teal-400">
                    Watch now
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides[activeIndex]?.stream_link && (
        <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute hero video" : "Mute hero video"} className="absolute right-6 top-6 z-20 rounded-full bg-black/60 p-3 text-white hover:bg-black/80">
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
      )}

      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => emblaApi?.scrollPrev()} aria-label="Previous featured slide" className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-80 hover:bg-black/80 focus-visible:opacity-100 md:left-6">
            <ChevronLeft size={24} />
          </button>
          <button type="button" onClick={advance} aria-label="Next featured slide" className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-80 hover:bg-black/80 focus-visible:opacity-100 md:right-6">
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
                className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
