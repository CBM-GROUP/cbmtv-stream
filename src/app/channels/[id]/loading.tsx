import { ContentRail } from "@/components/ContentRail";

export default function ChannelLoading() {
  return <div aria-label="Loading channel" aria-busy="true">
    <div className="channel-hero channel-hero-inner flex items-center gap-4" aria-hidden="true"><div className="size-20 shrink-0 animate-pulse rounded-xl bg-white/10 md:size-28" /><div className="w-full max-w-md space-y-3"><div className="h-8 w-3/4 rounded bg-white/10" /><div className="h-4 w-full rounded bg-white/5" /></div></div>
    <div className="py-6 md:py-8">{["TV Shows", "Movies", "Documentaries", "Animations"].map((title) => <ContentRail key={title} title={title} loading />)}</div>
  </div>;
}
