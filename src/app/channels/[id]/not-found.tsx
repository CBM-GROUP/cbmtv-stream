import Link from "next/link";

export default function ChannelNotFound() {
  return <section className="content-section py-10"><div className="channel-empty-state"><h1 className="text-2xl font-semibold">Channel not found</h1><p className="mt-3 text-sm text-white/60">This channel isn&apos;t available. Explore the other channels on CBM TV.</p><Link href="/channels" className="primary-action mt-5">Back to Channel Box</Link></div></section>;
}
