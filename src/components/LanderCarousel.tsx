"use client";
import { Advert } from "@/types";
import { SafeImage } from "@/components/SafeImage";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface LanderCarouselProps {
  slides: Advert[];
}

const IMAGE_SLIDE_DURATION = 5000; // 5 seconds for images

// NEW: Create a memoized Slide component
const Slide = React.memo(function Slide({
  slide,
  index,
  onVideoEnded,
  onVideoPlay,
  onVideoPause,
  setPlayerRef,
  togglePlayPause,
  isPlaying,
}: {
  slide: Advert;
  index: number;
  onVideoEnded: () => void;
  onVideoPlay: () => void;
  onVideoPause: () => void;
  setPlayerRef: (el: HTMLVideoElement | null) => void;
  togglePlayPause: () => void;
  isPlaying: boolean;
}) {
  return (
    <div
      className="embla__slide home-hero-slide relative w-full shrink-0"
    >
      {/* ---------- MEDIA (video or image) ---------- */}
      {slide.stream_link ? (
        <video
          ref={setPlayerRef}
          className="w-full h-full object-cover object-center shrink-0"
          src={slide.stream_link}
          poster={slide.advert_thumbnail || undefined}
          autoPlay
          muted
          playsInline
          preload="metadata"
          onEnded={onVideoEnded}
          onPlay={onVideoPlay}
          onPause={onVideoPause}
        />
      ) : (
        <SafeImage
          fill
          className="object-cover object-center w-full h-full shrink-0"
          src={slide.advert_thumbnail}
          alt={slide.advert_name ?? "CBM TV advert"}
          sizes="100vw"
          priority={index === 0}
        />
      )}
      <div className="w-full h-1/2 bg-gradient-to-b to-black md:to-black/80 from-transparent absolute bottom-0 left-0 flex items-end justify-start z-10 p-6 md:p-14">
        <div className="lg:w-1/3">
          <h1 className="text-white text-xl md:text-3xl font-bold">
            {slide.advert_name}
          </h1>
          <p className="mt-2">{slide?.advert_description}</p>
          {/* Play/Pause Button */}
          <Link href={slide.advert_link || "/"}>
            <button className="p-3 rounded-md bg-yellow-500/70 hover:bg-[#01BEA5] text-white transition-colors flex items-center space-x-2 mt-4 cursor-pointer">
              <Play size={18} />
              <span className="pr-5">Watch</span>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
});

export const LanderCarousel = ({ slides }: LanderCarouselProps) => {
  const autoplayRef = useRef<ReturnType<typeof Autoplay> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playerRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({
      delay: IMAGE_SLIDE_DURATION,
      stopOnInteraction: false,
      playOnInit: true,
    }),
  ]);

  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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

    console.log("Video ended, moving to next slide");
    setActiveVideoIndex(null);
    setIsVideoPlaying(false);

    // Immediately move to next slide after video ends
    emblaApi.scrollNext();
  }, [emblaApi]);

  // Handle video play state
  const onVideoPlay = useCallback(() => {
    setIsVideoPlaying(true);
    setIsPlaying(true);
  }, []);

  const onVideoPause = useCallback(() => {
    setIsVideoPlaying(false);
    setIsPlaying(false);
  }, []);

  // Handle slide selection
  const onSelect = useCallback(() => {
    if (!emblaApi) return;

    const idx = emblaApi.selectedScrollSnap();
    setCurrentIndex(idx);
    const slide = slides[idx];
    const player = playerRefs.current[idx];

    // Pause all other videos
    playerRefs.current.forEach((p, index) => {
      if (index !== idx && p) {
        p.pause();
      }
    });

    // Stop any pending timeout
    clearAdvanceTimeout();

    if (slide?.stream_link && player) {
      // Video slide
      console.log("Switching to video slide:", idx);
      setActiveVideoIndex(idx);
      emblaApi.plugins().autoplay?.stop();

      // Reset and play video
      player.currentTime = 0;

      // Try to play the video
      const playVideo = async () => {
        try {
          await player.play();
          setIsPlaying(true);
          setIsVideoPlaying(true);
          console.log("Video auto-play started");
        } catch (error) {
          console.error("Failed to auto-play video:", error);
          // If auto-play fails, resume normal carousel timing
          emblaApi.plugins().autoplay?.reset();
          scheduleNextSlide(IMAGE_SLIDE_DURATION);
        }
      };

      playVideo();
    } else {
      // Image slide
      console.log("Switching to image slide:", idx);
      setActiveVideoIndex(null);
      setIsVideoPlaying(false);

      if (isPlaying) {
        emblaApi.plugins().autoplay?.reset();
        scheduleNextSlide(IMAGE_SLIDE_DURATION);
      }
    }
  }, [emblaApi, slides, isPlaying]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!emblaApi) return;

    if (isPlaying) {
      // Pause everything
      setIsPlaying(false);
      emblaApi.plugins().autoplay?.stop();
      clearAdvanceTimeout();

      // Pause video if active
      if (activeVideoIndex !== null) {
        const player = playerRefs.current[activeVideoIndex];
        if (player) {
          player.pause();
          setIsVideoPlaying(false);
        }
      }
    } else {
      // Play everything
      setIsPlaying(true);

      const slide = slides[currentIndex];
      if (slide?.stream_link && activeVideoIndex !== null) {
        // Resume video
        const player = playerRefs.current[activeVideoIndex];
        if (player) {
          player
            .play()
            .then(() => {
              setIsVideoPlaying(true);
            })
            .catch(console.error);
        }
      } else {
        // Resume carousel autoplay for images
        emblaApi.plugins().autoplay?.reset();
        scheduleNextSlide(IMAGE_SLIDE_DURATION);
      }
    }
  }, [emblaApi, isPlaying, activeVideoIndex, currentIndex, slides]);

  // Navigate to specific slide
  const scrollTo = useCallback(
    (index: number) => {
      if (!emblaApi) return;

      // Pause current video if any
      if (activeVideoIndex !== null) {
        const player = playerRefs.current[activeVideoIndex];
        if (player) {
          player.pause();
          setIsVideoPlaying(false);
        }
      }

      emblaApi.scrollTo(index);
    },
    [emblaApi, activeVideoIndex]
  );

  // Initialize player refs array
  useEffect(() => {
    playerRefs.current = playerRefs.current.slice(0, slides.length);
  }, [slides.length]);

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
    <div className="relative group">
      {/* Main carousel container */}
      <div className="w-full embla gap-0" ref={emblaRef}>
        <div className="embla__container w-full p-0 m-0">
          {slides?.map((slide: Advert, index: number) => (
            <Slide
              key={slide.id ?? index}
              slide={slide}
              index={index}
              onVideoEnded={onVideoEnded}
              onVideoPlay={onVideoPlay}
              onVideoPause={onVideoPause}
              setPlayerRef={(el) => {
                playerRefs.current[index] = el;
              }}
              isPlaying={isPlaying}
              togglePlayPause={togglePlayPause}
            />
          ))}
        </div>
      </div>

      {/* Navigation Controls - Only show on hover/touch */}
      <div className="absolute inset-x-4 top-1/2 transform -translate-y-1/2 flex justify-between items-center z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {/* Previous Button */}
        <button
          onClick={() => emblaApi?.scrollPrev()}
          className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors backdrop-blur-sm"
          aria-label="Previous slide"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Next Button */}
        <button
          onClick={() => emblaApi?.scrollNext()}
          className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors backdrop-blur-sm"
          aria-label="Next slide"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};
