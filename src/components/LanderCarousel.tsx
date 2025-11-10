"use client";
import { Advert } from "@/types";
import MuxPlayer from "@mux/mux-player-react";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getPlaybackId } from "@/lib/helpers";
import { useCallback, useEffect, useRef, useState } from "react";

interface LanderCarouselProps {
  slides: Advert[];
}

const PLACEHOLDER_IMAGE = "/images/cbmtvwhitelogo.png";
const IMAGE_SLIDE_DURATION = 5000; // 5 seconds for images

export const LanderCarousel = ({ slides }: LanderCarouselProps) => {
  const autoplayRef = useRef<ReturnType<typeof Autoplay> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playerRefs = useRef<(React.ComponentRef<typeof MuxPlayer> | null)[]>([]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({
      delay: IMAGE_SLIDE_DURATION,
      stopOnInteraction: false,
      playOnInit: true,
    }),
  ]);

  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);

  // Clear any pending timeout
  const clearAdvanceTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Schedule next slide after delay (for images)
  const scheduleNextSlide = (delay: number) => {
    clearAdvanceTimeout();
    timeoutRef.current = setTimeout(() => {
      emblaApi?.scrollNext();
    }, delay);
  };

  // Handle video end
  const onVideoEnded = useCallback(() => {
    if (!emblaApi) return;
    setActiveVideoIndex(null);
    emblaApi.plugins().autoplay?.reset(); // Resume autoplay
    scheduleNextSlide(IMAGE_SLIDE_DURATION); // Advance after image delay
  }, [emblaApi]);

  // Handle slide selection
  const onSelect = useCallback(() => {
    if (!emblaApi) return;

    const idx = emblaApi.selectedScrollSnap();
    const slide = slides[idx];
    const player = playerRefs.current[idx];

    // Pause all videos
    playerRefs.current.forEach((p) => p?.pause());

    // Stop any pending timeout
    clearAdvanceTimeout();

    if (slide?.stream_link && player) {
      // Video slide
      setActiveVideoIndex(idx);
      emblaApi.plugins().autoplay?.stop();
      player.currentTime = 0;
      player.play().catch(() => {});
      // Autoplay will resume on 'ended' event
    } else {
      // Image slide
      setActiveVideoIndex(null);
      emblaApi.plugins().autoplay?.reset();
      scheduleNextSlide(IMAGE_SLIDE_DURATION);
    }
  }, [emblaApi, slides]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAdvanceTimeout();
      playerRefs.current.forEach((p) => p?.pause());
    };
  }, []);

  // Subscribe to Embla events
  useEffect(() => {
    if (!emblaApi) return;

    onSelect(); // Initial call
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <>
      <div
        className="overflow-hidden w-full mx-auto flex items-center justify-center h-[50vh] md:h-[70vh]"
        ref={emblaRef}
      >
        <div className="flex w-full h-full">
          {slides?.map((slide: Advert, index: number) => (
            <div
              className="embla__slide relative h-full w-screen flex-shrink-0"
              key={index}
            >
              {/* ---------- MEDIA (video or image) ---------- */}
              {slide.stream_link ? (
                <MuxPlayer
                  ref={(el) => {
                    playerRefs.current[index] = el;
                  }}
                  className="w-full h-full object-cover"
                  playbackId={getPlaybackId(slide.stream_link) ?? ""}
                  title={slide.advert_name}
                  autoPlay={false}
                  muted
                  onEnded={onVideoEnded}
                />
              ) : (
                <Image
                  fill
                  className="object-cover object-center"
                  src={slide.advert_thumbnail || PLACEHOLDER_IMAGE}
                  alt={slide.advert_name}
                  sizes="100vw"
                  priority
                />
              )}

              {/* ---------- OVERLAY TEXT & CTA ---------- */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent text-white p-4 sm:p-8 md:p-12 w-full">
                <div className="flex items-end justify-between">
                  <div className="w-full md:w-3/5 lg:w-2/5">
                    <h1 className="text-xl sm:text-2xl md:text-2xl capitalize font-semibold">
                      {slide.advert_name}
                    </h1>
                    <p className="text-white/60 text-base sm:text-lg my-4 line-clamp-2 capitalize">
                      {slide.advert_description}
                    </p>
                  </div>
                  <Link
                    href={slide.advert_link || "#"}
                    target="_blank"
                    className="flex items-center space-x-2 text-sm font-light text-white/60"
                  >
                    <span>Explore</span>
                    <ArrowRight size={16} strokeWidth={1.5} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
