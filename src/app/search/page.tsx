import { Suspense } from "react";
import { SearchResults } from "@/components/SearchResults";

export const metadata = { title: "CBM TV | Search" };

export default function SearchPage() {
  return <Suspense fallback={<div className="mx-auto max-w-6xl px-5 py-12 text-white">Loading search…</div>}>
    <SearchResults />
  </Suspense>;
}
