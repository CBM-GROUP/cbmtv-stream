"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BROWSE_CATEGORIES } from "@/lib/catalogue";
import { newestEligible } from "@/lib/catalogue";
import { listCataloguePage, type CatalogueCursor } from "@/services/content";
import type { ContentType } from "@/types";
import { ProgramCard } from "./ProgramCard";

export function CatalogueBrowser({ category }: { category?: ContentType }) {
  const query = useInfiniteQuery({
    queryKey: ["catalogue", category ?? "all"],
    queryFn: ({ pageParam, signal }) => listCataloguePage(category, pageParam, signal),
    initialPageParam: 1 as CatalogueCursor,
    getNextPageParam: (page) => page.nextPage,
    staleTime: 60_000,
    retry: 1,
  });
  const items = newestEligible(query.data?.pages.flatMap((page) => page.items) ?? []);
  return <section className="content-section py-6 md:py-10">
    <h1 className="mb-5 text-3xl font-semibold">{BROWSE_CATEGORIES.find((item) => item.type === category)?.title ?? "Explore CBM TV"}</h1>
    <nav className="h-scroll mb-6 flex gap-2 pb-2" aria-label="Content categories">
      {[{ type: undefined, title: "All" }, ...BROWSE_CATEGORIES].map((item) => <Link key={item.type ?? "all"} href={item.type ? `/programs?category=${item.type}` : "/programs"} aria-current={item.type === category ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm ${item.type === category ? "bg-teal-400 text-black" : "bg-white/10 text-white/75 hover:bg-white/20"}`}>{item.title}</Link>)}
    </nav>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-5" aria-busy={query.isFetching}>
      {query.isPending ? Array.from({ length: 12 }, (_, i) => <div key={i} aria-hidden="true"><div className="aspect-2/3 animate-pulse rounded-lg bg-white/10" /><div className="mt-2 h-10 bg-white/5" /></div>) : items.map((item) => <ProgramCard key={item.id} id={item.id} title={item.title} src={item.thumbnail} alt={item.title} slug={`programs/${item.id}`} href={`/programs/${item.id}`} />)}
    </div>
    {query.isError && <div role="alert" className="mt-6 flex gap-4 text-sm text-white/70"><p>Couldn&apos;t load titles.</p><button className="text-teal-300 underline" onClick={() => { void query.refetch(); }}>Try again</button></div>}
    {!query.isPending && !query.isError && !items.length && <p role="status" className="py-10 text-white/65">No titles are available here yet.</p>}
    {query.hasNextPage && <button className="primary-action mx-auto mt-6 flex disabled:opacity-60" disabled={query.isFetchingNextPage} onClick={() => { void query.fetchNextPage(); }}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
  </section>;
}
