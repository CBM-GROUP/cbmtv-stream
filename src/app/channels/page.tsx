import type { Metadata } from "next";
import { ChannelDirectory } from "@/components/ChannelDirectory";

export const metadata: Metadata = {
  title: "CBM TV | Channel Box",
  description: "Explore CBM TV channels and discover TV shows, movies, documentaries and animations.",
};

export default function ChannelsPage() {
  return <ChannelDirectory />;
}