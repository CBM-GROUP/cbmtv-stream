"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SafeImage } from "@/components/SafeImage";
import { useSearch } from "@/hooks/useSearch";
import { SEARCH_MODES, type SearchMode } from "@/services/search";

const PAGE_SIZE = 20;

export function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const query = (params.get("q") || "").trim();
  const requestedMode = params.get("search_by");
  const mode: SearchMode = SEARCH_MODES.find(({ value }) => value === requestedMode)?.value || "title";
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const { data, isPending, isFetching, isError } = useSearch(query, PAGE_SIZE, mode, (page - 1) * PAGE_SIZE);

  const navigate = (nextQuery: string, nextMode: SearchMode, nextPage = 1) => {
    const next = new URLSearchParams({ q: nextQuery.trim(), search_by: nextMode });
    if (nextPage > 1) next.set("page", String(nextPage));
    router.push(`/search?${next.toString()}`);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(draft, mode);
  };

  return <section className="mx-auto min-h-[60vh] max-w-6xl px-5 py-10 text-white sm:px-8">
    <h1 className="text-3xl font-semibold">Search CBM TV</h1>
    <form onSubmit={submit} role="search" className="mt-6 flex flex-wrap gap-3">
      <input
        aria-label="Search query"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search titles"
        className="min-w-0 flex-1 basis-48 rounded-md border border-white/20 bg-white/10 px-4 py-3 text-white"
      />
      <button type="submit" className="rounded-md bg-white px-5 py-3 font-medium text-black">Search</button>
    </form>
    <div className="mt-4 flex items-center gap-3 text-sm">
      <label htmlFor="search-mode" className="text-white/70">Search by</label>
      <select
        id="search-mode"
        aria-label="Search by"
        value={mode}
        onChange={(event) => navigate(query, event.target.value as SearchMode)}
        className="rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white"
      >
        {SEARCH_MODES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    {!query && <p className="mt-8 text-white/70">Enter a title to search.</p>}
    {query && (isPending || isFetching) && <p className="mt-8" role="status">Searching…</p>}
    {query && isError && <p className="mt-8 text-red-300" role="alert">Search is unavailable. Please try again.</p>}
    {query && !isPending && !isFetching && !isError && data?.hits.length === 0 &&
      <p className="mt-8 text-white/70">No results for “{query}” in {SEARCH_MODES.find((option) => option.value === mode)?.label}.</p>}
    {query && !isPending && !isFetching && !isError && data && data.hits.length > 0 && <>
      <p className="mt-8 text-sm text-white/70">{data.total} result{data.total === 1 ? "" : "s"}</p>
      <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {data.hits.map((hit) => <li key={hit.id}>
          <Link href={`/programs/${hit.id}`} className="block rounded-lg bg-white/5 p-2 hover:bg-white/10">
            <div className="aspect-[2/3] overflow-hidden rounded bg-white/10">
              {hit.thumbnail && <SafeImage src={hit.thumbnail} alt="" width={320} height={480} className="h-full w-full object-cover" />}
            </div>
            <span className="mt-2 block font-medium">{hit.title}</span>
            <span className="block text-sm text-white/60">{[hit.director, hit.genre].filter(Boolean).join(" · ")}</span>
          </Link>
        </li>)}
      </ul>
      <nav aria-label="Search result pages" className="mt-8 flex gap-3">
        {page > 1 && <button type="button" onClick={() => navigate(query, mode, page - 1)} className="rounded border border-white/30 px-4 py-2">Previous</button>}
        {data.next_offset !== null && <button type="button" onClick={() => navigate(query, mode, page + 1)} className="rounded border border-white/30 px-4 py-2">Next</button>}
      </nav>
    </>}
  </section>;
}
