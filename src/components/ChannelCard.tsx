import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import type { Channel } from "@/types";

export default function ChannelCard({ channel }: { channel: Channel }) {
  return <Link href={"/channels/" + channel.id} className="channel-directory-card group flex min-w-0 flex-col rounded-xl border border-white/5 bg-white/5 p-2 transition-colors hover:border-teal-300/30 hover:bg-white/10 sm:p-3">
    <div className="relative aspect-square overflow-hidden rounded-lg bg-black/30">
      <SafeImage src={channel.cover_image_url || channel.logo_url} alt="" fill className="object-contain transition-transform duration-300 motion-safe:group-hover:scale-[1.02]" sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 768px) 29vw, 44vw" />
    </div>
    <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
      <div className="flex items-start gap-2">
        <h2 className="min-h-10 min-w-0 flex-1 text-sm font-semibold leading-5 text-white sm:text-base">{channel.name}</h2>
        <ChevronRight size={16} className="mt-0.5 shrink-0 text-white/50 group-hover:text-teal-300" aria-hidden="true" />
      </div>
      {channel.description?.trim() && <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/60 sm:text-sm">{channel.description}</p>}
    </div>
  </Link>;
}
