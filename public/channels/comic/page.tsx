'use client'

import React, { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import Image from 'next/image'

const autoplay = Autoplay({ delay: 4000, stopOnInteraction: false })

const sections = {
  "comic movies": [
    { src: "/channels/comic/movies/comedymovie1.jpg", url: "https://youtube.com/watch?v=genre1" },
    { src: "/channels/comic/movies/comedymovie2.jpg", url: "https://youtube.com/watch?v=genre2" },
    { src: "/channels/comic/movies/comedymovie3.jpg", url: "https://youtube.com/watch?v=genre3" },
    { src: "/channels/comic/movies/comedymovie4.jpg", url: "https://youtube.com/watch?v=genre4" },
    { src: "/channels/comic/movies/comedymovie5.jpg", url: "https://youtube.com/watch?v=genre5" },
    { src: "/channels/comic/movies/comedymovie6.jpg", url: "https://youtube.com/watch?v=genre6" },
    { src: "/channels/comic/movies/comedymovie7.jpg",  url: "https://youtube.com/watch?v=genre7" },
    { src: "/channels/comic/movies/comedymovie1.jpg", url: "https://youtube.com/watch?v=genre8" },
  ],
  "comic shows and events": [
    { src: "/channels/comic/shows/dr.hillary.jpg", url: "https://youtube.com/watch?v=movie1" },
    { src: "/channels/comic/shows/comedy store.jpg", url: "https://youtube.com/watch?v=movie2" },
    { src: "/channels/comic/shows/kansiime.jpg", url: "https://youtube.com/watch?v=movie3" },
    { src: "/channels/comic/shows/pablo.jpg", url: "https://youtube.com/watch?v=movie4" },
    { src: "/channels/comic/shows/basketmouth.jpg", url: "https://youtube.com/watch?v=movie6" },
    { src: "/channels/comic/shows/fun factory.jpg", url: "https://youtube.com/watch?v=movie7" },
    { src: "/channels/comic/shows/trevor noah.jpg", url: "https://youtube.com/watch?v=movie8" },
    { src: "/channels/comic/shows/amooti.jpg", url: "https://youtube.com/watch?v=movie6" },
    { src: "/channels/comic/shows/wildn'out.jpg", url: "https://youtube.com/watch?v=movie7" },
    { src: "/channels/comic/shows/katt williams.jpg", url: "https://youtube.com/watch?v=movie8" },
  ],

}

function CarouselSection({
  title,
  items,
}: {
  title: string
  items: { src: string; url: string }[]
}) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true }, [autoplay])
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const scrollPrev = useCallback(() => embla?.scrollPrev(), [embla])
  const scrollNext = useCallback(() => embla?.scrollNext(), [embla])

  useEffect(() => {
    if (!embla) return
    const updateButtons = () => {
      setCanScrollPrev(embla.canScrollPrev())
      setCanScrollNext(embla.canScrollNext())
    }
    embla.on("select", updateButtons)
    updateButtons()
  }, [embla])

  return (
    <section style={{ position: "relative", marginBottom: "4rem" }}>
      <h2 style={{ color: "#fff", marginBottom: "1rem" }}>{title}</h2>

      <div className="embla" ref={emblaRef}>
        <div className="embla__container">
          {items.map((item, index) => (
            <div className="embla__slide" key={index}>
              <Image
                src={item.src}
                alt={title}
                width={300}
                height={200}
                onClick={() => window.open(item.url, "_blank")}
                style={{
                  width: "100%",
                  height: "300px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              />
            </div>
          ))}
        </div>

        <button
          className={`previous ${!canScrollPrev ? "disabled" : ""}`}
          onClick={scrollPrev}
        >
          &#8249;
        </button>

        <button
          className={`next ${!canScrollNext ? "disabled" : ""}`}
          onClick={scrollNext}
        >
          &#8250;
        </button>
      </div>
    </section>
  )
}

export default function MusicChannelPage() {
  return (
    <main style={{ backgroundColor: "#000", padding: "16px", minHeight: "100vh" }}>
      {Object.entries(sections).map(([title, items]) => (
        <CarouselSection key={title} title={title} items={items} />
      ))}
    </main>
  )
}
