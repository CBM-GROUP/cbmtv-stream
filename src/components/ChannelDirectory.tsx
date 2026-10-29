"use client";

import ChannelCard from "@/components/ChannelCard";
import { useChannels } from "@/hooks/useChannels";

function DirectorySkeleton() {
  return <div className="channel-directory-grid" aria-label="Loading channels" aria-busy="true">
    {Array.from({ length: 5 }, (_, i) => <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-2 sm:p-3" aria-hidden="true"><div className="aspect-square animate-pulse rounded-lg bg-white/10" /><div className="mx-1 mb-1 mt-3 h-10 rounded bg-white/5" /></div>)}
  </div>;
}

export function ChannelDirectory() {
  const { data: channels, isPending, isError, refetch } = useChannels();
  return <section className="content-section py-6 md:py-9" aria-labelledby="channel-box-title">
    <div className="mb-6 max-w-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-teal-300">Discover CBM TV</p>
      <h1 id="channel-box-title" className="text-3xl font-semibold tracking-tight md:text-4xl">Channel Box</h1>
      <p className="mt-3 text-sm leading-6 text-white/65 md:text-base">Explore our channels and find your next story.</p>
    </div>
    {isPending ? <DirectorySkeleton /> : isError ? <div className="channel-empty-state" role="alert"><h2 className="text-lg font-semibold">Channels couldn&apos;t be loaded</h2><p className="mt-2 text-sm text-white/60">Please try again in a moment.</p><button className="primary-action mt-5" onClick={() => { void refetch(); }}>Try again</button></div> : !channels?.length ? <div className="channel-empty-state" role="status"><h2 className="text-lg font-semibold">No channels available yet</h2><p className="mt-2 text-sm text-white/60">Check back soon for new channels.</p></div> : <div className="channel-directory-grid">{channels.map((channel) => <ChannelCard key={channel.id} channel={channel} />)}</div>}
  </section>;
}
