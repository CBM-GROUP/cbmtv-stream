'use client'

import React, { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import Image from 'next/image'

const autoplay = Autoplay({ delay: 4000, stopOnInteraction: false })

const sections = {
  "Music Genres": [
    { src: "/channels/music/genre/trap.jpg", url: "https://youtube.com/watch?v=genre1" },
    { src: "/channels/music/genre/rnb2.jpg", url: "https://youtube.com/watch?v=genre2" },
    { src: "/channels/music/genre/rnb1.jpg", url: "https://youtube.com/watch?v=genre3" },
    { src: "/channels/music/genre/rnb.jpg", url: "https://youtube.com/watch?v=genre4" },
    { src: "/channels/music/genre/pop2.jpg", url: "https://youtube.com/watch?v=genre5" },
    { src: "/channels/music/genre/afrobeat1.jpg", url: "https://youtube.com/watch?v=genre6" },
    { src: "/channels/music/genre/electronic.jpg", url: "https://youtube.com/watch?v=genre7" },
    { src: "/channels/music/genre/pop.jpg", url: "https://youtube.com/watch?v=genre8" },
    { src: "/channels/music/genre/reggae.jpg", url: "https://youtube.com/watch?v=genre8" },
  ],
  "Music Movies & Documentaries": [
    { src: "/channels/music/docs&movies/musicdoc1.jpg", url: "https://youtube.com/watch?v=movie1" },
    { src: "/channels/music/docs&movies/musicdoc2.jpg", url: "https://youtube.com/watch?v=movie2" },
    { src: "/channels/music/docs&movies/musicdoc3.jpg", url: "https://youtube.com/watch?v=movie3" },
    { src: "/channels/music/docs&movies/musicdoc4.jpg", url: "https://youtube.com/watch?v=movie4" },
    { src: "/channels/music/docs&movies/musicdoc5.jpg", url: "https://youtube.com/watch?v=movie5" },
    { src: "/channels/music/docs&movies/musicmovie.jpg", url: "https://youtube.com/watch?v=movie6" },
    { src: "/channels/music/docs&movies/musicmovie2.jpg", url: "https://youtube.com/watch?v=movie7" },
    { src: "/channels/music/docs&movies/musicmovie3.jpg", url: "https://youtube.com/watch?v=movie8" },
    { src: "/channels/music/docs&movies/musicmovie4.jpg", url: "https://youtube.com/watch?v=movie8" },
    
  ],
  "Music Events": [
    { src: "/channels/music/events/event1.jpg", url: "https://youtube.com/watch?v=event1" },
    { src: "/channels/music/events/event2.jpg", url: "https://youtube.com/watch?v=event2" },
    { src: "/channels/music/events/event3.jpg", url: "https://youtube.com/watch?v=event3" },
    { src: "/channels/music/events/event4.jpg", url: "https://youtube.com/watch?v=event4" },
    { src: "/channels/music/events/event5.jpg", url: "https://youtube.com/watch?v=event5" },
    { src: "/channels/music/events/event6.jpg", url: "https://youtube.com/watch?v=event6" },
    { src: "/channels/music/events/event7.png", url: "https://youtube.com/watch?v=event7" },
    { src: "/channels/music/events/event8.jpg", url: "https://youtube.com/watch?v=event8" },
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
