"use client";

import Image from "next/image";
import styles from "@/styles/ImageGrid.module.css";

const images = [
  "/channels/sports/sports1.png",
  "/channels/sports/volley.jpg",
  "/channels/sports/raga.jpg",
  "/channels/sports/fuba.jpg",
  "/channels/sports/baco ug.jpg",
  "/channels/sports/cricket.jpg",
  "/channels/sports/upl.png",
 "/channels/sports/copa cola ug.jpg",
 "/channels/sports/boxing ug.jpg",
  "/channels/sports/epl.jpg",
  "/channels/sports/champions league.jpg",
  "/channels/sports/europa league.png",
  "/channels/sports/uganda cup.png",
  "/channels/sports/serie a.jpg",
  "/channels/sports/laliga.png",
  "/channels/sports/budesiliga.png",
  "/channels/sports/carabao.png",

  // Add fewer or more images as needed
];

export default function ImageGrid() {
  return (
    <div className={styles.gridContainer}>
      {images.slice(0, 16).map((src, index) => (
        <div key={index} className={styles.imageWrapper}>
          <Image
            src={src}
            alt={`Program ${index + 1}`}
            width={300}
            height={300}
            className={styles.image}
          />
        </div>
      ))}
    </div>
  );
}
