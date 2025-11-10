'use client';

import Swiper from './ChannelSwiper';

interface Channel {
  title: string;
  src: string;
  href: string;
}

export default function ChannelCarousel({ channels }: { channels: Channel[] }) {
  return (
    <div className="md:px-10 px-4 py-16">
      <Swiper posters={channels} slidesToShow={5} slidesToScroll={1} />
    </div>
  );
}