import Link from "next/link";
import { TrendingUp } from "lucide-react";

export function TrendsPage() {
  return <section className="content-section trends-page">
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-300">Discover CBM TV</p><h1 className="text-3xl font-semibold md:text-4xl">Trends</h1>
    <div className="trends-unavailable" role="status"><TrendingUp size={28} className="text-teal-300" aria-hidden="true" /><h2 className="mt-4 text-xl font-semibold">Trending titles aren&apos;t available yet</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/60">Explore movies, TV shows, documentaries and animations.</p><Link className="primary-action mt-6" href="/programs">Explore titles</Link><Link className="mt-4 inline-flex min-h-11 items-center text-sm text-white/70 hover:text-teal-300" href="/channels">Browse Channel Box</Link></div>
  </section>;
}
