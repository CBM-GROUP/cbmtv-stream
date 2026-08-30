import { listChannels } from "@/services/channels";
import { SafeImage } from "@/components/SafeImage";
import { Metadata } from "next";
import Link from "next/link";
import type { Channel } from "@/types";

export const metadata: Metadata = {
  title: "CBM TV | Channels",
  description: "Browse all the channels available on CBM TV.",
};

export default async function ChannelsPage() {
  let channels: Channel[] = [];
  try {
    channels = await listChannels();

  } catch (error) {
    console.error("Error fetching channels:", error);
  }


  return (
    <div className="px-5 md:px-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 pt-5 pb-24 gap-5">
      {channels?.map((channel: Channel, index: number) => (
        <Link href={`/channels/${channel.id}`} key={index}>
          <div className="bg-white/5 p-3 tetxt-center rounded-xl">
            <SafeImage
              src={channel.cover_image_url}
              alt={channel.name}
              width={300}
              height={300}
              className="channel-image rounded-lg aspect-1/1"
            />

            <div className="text-center py-3 capitalize line-clamp-1">{channel.name}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
