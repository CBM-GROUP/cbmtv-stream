"use client";

import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import { Button } from "./ui/button";

// Type definitions
interface Poster {
  title: string;
  src: string;
  href: string;
}

interface SwiperProps {
  posters: Poster[];
  slidesToShow?: number;
  slidesToScroll?: number;
}

interface ArrowProps {
  onClick?: () => void;
}

const Swiper = ({
  posters,
  slidesToShow: initialSlidesToShow = 5,
  slidesToScroll = 1,
}: SwiperProps) => {
  const [slidesToShow, setSlidesToShow] = useState(initialSlidesToShow);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 480) {
        setSlidesToShow(2);
      } else if (window.innerWidth <= 640) {
        setSlidesToShow(2);
      } else if (window.innerWidth <= 768) {
        setSlidesToShow(3);
      } else if (window.innerWidth <= 1024) {
        setSlidesToShow(4);
      } else if (window.innerWidth <= 1280) {
        setSlidesToShow(5);
      } else {
        setSlidesToShow(initialSlidesToShow);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [initialSlidesToShow]);

  // Custom Arrow Components
  const NextArrow = ({ onClick }: ArrowProps) => (
    <div
      className="max-md:hidden absolute -right-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer text-white opacity-100 hover:opacity-100 text-2xl h-12 w-12 flex items-center justify-center rounded-full hover:bg-white/10 "
      onClick={onClick}
    >
      <ArrowRight size={18} />
    </div>
  );

  const PrevArrow = ({ onClick }: ArrowProps) => (
    <div
      className="max-md:hidden absolute -left-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer text-white opacity-100 hover:opacity-100 text-2xl h-12 w-12 flex items-center justify-center  hover:bg-white/10  rounded-full"
      onClick={onClick}
    >
      <ArrowLeft size={18} />
    </div>
  );

  const settings = {
    dots: false,
    infinite: posters.length > slidesToShow,
    speed: 800,
    slidesToShow,
    slidesToScroll,
    autoplay: true,
    autoplaySpeed: 2500,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
  };

  return (
    <div className="relative">
      <Slider {...settings}>
        {posters.slice(0, 10).map((poster, index) => (
          <Link
            href={poster.href}
            key={index}
            className="px-4 py-4 md:py-2 md:px-2"
          >
            <div className="flex items-center flex-col md:flex-row justify-center md:justify-start md:space-x-4 bg-white/3 p-2 max-md:py-6 rounded-xl cursor-pointer">
              <div className="relative h-20 w-20 aspect-square rounded-lg shadow-md overflow-hidden">
                <SafeImage
                  src={poster.src}
                  alt={poster.href || `Poster ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                />
              </div>
              <h3 className="text-white/60 text-sm mt-4 md:mt-0 text-center md:text-left">
                {poster.title}
              </h3>
            </div>
          </Link>
        ))}
      </Slider>
      <Link href="/channels">
        <button className="absolute -bottom-24  left-1/2 -translate-x-1/2 rounded-lg bg-none text-[#01BEA5] border border-transparent hover:border-[#01BEA5] font-normal h-12 py-6 px-8 capitalize cursor-pointer mt-3 whitespace-nowrap flex items-center justify-center">
          <span className=" space-x-3 flex items-center">
            <span className="text-sm">Explore All Channels</span>
            <ChevronRight size={14} />
          </span>
        </button>
      </Link>
    </div>
  );
};

export default Swiper;
