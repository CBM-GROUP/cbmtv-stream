"use client";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { Providers } from "@/components/Providers";
import { AuthProvider } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import Preloader from "@/components/Preloader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/cbm logo (1).png" />
        <title>CBM TV</title>
        <meta
          name="description"
          content="CBM TV is an internet-based, digital video-on-demand streaming platform showcasing a diverse catalogue of channels and TV shows, movies, documentaries, animation and music videos from across Africa."
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen overflow-x-hidden overflow-y-auto relative`}
      >
        <AuthProvider>
          <Providers>
            {loading ? (
              <Preloader />
            ) : (
              <>
                <NavBar />
                {children}
                <Footer />
              </>
            )}
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
