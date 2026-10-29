"use client";
export default function ProgramError({ reset }: { reset: () => void }) {
  return <div className="mx-auto min-h-[65vh] max-w-lg px-5 py-20 text-center"><h1 className="text-2xl font-bold">This title couldn&apos;t be loaded</h1><p className="mt-3 text-sm text-white/65">Check your connection and try again.</p><button className="primary-action mt-6" onClick={reset}>Try again</button></div>;
}
