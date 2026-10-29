"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SafeImage } from "@/components/SafeImage";
import { ContentRail } from "@/components/ContentRail";
import { buildChannelCatalogue } from "@/lib/catalogue";
import { listChannelContents } from "@/services/channels";
import type { Channel } from "@/types";

export default function ChannelPageClient({ channel }: { channel: Channel }) {
  const query = useQuery({
    queryKey: ["channel-contents", channel.id],
    queryFn: () => listChannelContents(channel.id),
    staleTime: 60_000,
    retry: 1,
  });
  const catalogue = buildChannelCatalogue(query.data ?? []);
  const artwork = channel.cover_image_url || channel.logo_url;

  return <>
    <section className="channel-hero relative isolate overflow-hidden" aria-labelledby="channel-title">
      {artwork && <SafeImage src={artwork} alt="" fill className="pointer-events-none -z-10 object-cover opacity-20" sizes="100vw" priority />}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/65 to-transparent" />
      <div className="channel-hero-inner">
        <Link href="/channels" className="mb-4 inline-flex min-h-11 items-center gap-1 rounded text-sm text-white/70 hover:text-teal-300"><ChevronLeft size={16} />Channel Box</Link>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 md:size-28"><SafeImage src={channel.logo_url || channel.cover_image_url} alt="" fill className="object-contain p-2" sizes="(min-width: 768px) 112px, 80px" priority /></div>
          <div className="min-w-0 max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-teal-300">CBM TV Channel</p>
            <h1 id="channel-title" className="channel-title text-2xl font-semibold leading-tight tracking-tight md:text-4xl">{channel.name}</h1>
            {channel.description?.trim() && <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/75">{channel.description}</p>}
          </div>
        </div>
      </div>
    </section>
    <div className="channel-catalogue py-6 md:py-8">
      {query.isPending ? <div aria-label="Loading channel content" aria-busy="true">{["TV Shows", "Movies", "Documentaries", "Animations"].map((title) => <ContentRail key={title} title={title} loading />)}</div> : query.isError ? <div className="content-section"><div className="channel-empty-state" role="alert"><h2 className="text-lg font-semibold">This channel&apos;s titles couldn&apos;t be loaded</h2><p className="mt-2 text-sm text-white/60">The channel is still available. Try loading its titles again.</p><button className="primary-action mt-5" onClick={() => { void query.refetch(); }}>Try again</button></div></div> : !catalogue.published.length ? <div className="content-section"><div className="channel-empty-state" role="status"><h2 className="text-lg font-semibold">More stories are on the way</h2><p className="mt-2 text-sm text-white/60">There are no published titles in this channel yet.</p><Link href="/channels" className="mt-4 inline-flex min-h-11 items-center text-sm text-teal-300 hover:text-white">Explore Channel Box</Link></div></div> : <>
        {catalogue.sections.length > 1 && <nav className="content-section h-scroll flex gap-2 pb-2" aria-label="Browse this channel">{catalogue.sections.map((section) => <a key={section.type} href={"#channel-" + section.type} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/75 hover:border-teal-300/40 hover:text-teal-300">{section.title}</a>)}</nav>}
        <ContentRail title="Featured on this channel" items={catalogue.featured} />
        {catalogue.sections.map((section) => <div key={section.type} id={"channel-" + section.type} className="scroll-mt-24"><ContentRail title={section.title} items={section.items} /></div>)}
        <ContentRail title="More from this channel" items={catalogue.other} />
        <ContentRail title="Recently Added" items={catalogue.recent} />
      </>}
    </div>
  </>;
}
