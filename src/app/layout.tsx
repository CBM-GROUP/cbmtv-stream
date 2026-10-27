"use client";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { Providers } from "@/components/Providers";
import { AuthProvider } from "@/context/AuthContext";

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
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>CBM TV</title>
        <meta
          name="description"
          content="CBM TV is an internet-based, digital video-on-demand streaming platform showcasing a diverse catalogue of channels and TV shows, movies, documentaries, animation and music videos from across Africa."
        />
      </head>
      {/*
        No `h-screen overflow-y-auto` here. That made <body> the scroll
        container, which (a) competed with the viewport for scrolling and
        (b) forced `overflow-x: clip` in globals.css to degrade to `hidden`,
        re-establishing the very scroll container that breaks `position:
        sticky` on the NavBar. The viewport is now the single page scroll
        container; see the containment comment in globals.css.
      */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased relative`}
      >
        <AuthProvider>
          <Providers>
            <NavBar />
            <main id="main-content">{children}</main>
            <Footer />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
