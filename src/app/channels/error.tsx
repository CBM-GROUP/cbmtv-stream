"use client";

import Link from "next/link";

export default function ChannelsError({ reset }: { reset: () => void }) {
  return <section className="content-section py-10"><div className="channel-empty-state" role="alert"><h1 className="text-2xl font-semibold">Channels are temporarily unavailable</h1><p className="mt-3 text-sm text-white/60">Please try again in a moment.</p><div className="mt-5 flex flex-wrap items-center justify-center gap-4"><button onClick={reset} className="primary-action">Try again</button><Link href="/channels" className="inline-flex min-h-11 items-center text-sm text-teal-300">Back to Channel Box</Link></div></div></section>;
}
