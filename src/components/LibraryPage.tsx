"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSavedItems } from "@/hooks/useLibrary";
import { ContinueWatchingRail } from "./ContinueWatchingRail";
import { ProgramCard } from "./ProgramCard";
import { MyListButton } from "./MyListButton";

function SavedTitles() {
  const query = useSavedItems();
  const items = [...new Map((query.data ?? []).filter((row) => row.content.status === "approved").map((row) => [row.content.id, row])).values()];
  return <div className="content-section">{query.isPending ? <p role="status">Loading your list…</p> : query.isError ? <div role="alert"><p>Your list couldn&apos;t be loaded.</p><button className="detail-secondary-action mt-4" onClick={() => { void query.refetch(); }}>Try again</button></div> : !items.length ? <p role="status" className="text-white/65">Your list is empty. Save a title to find it here.</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-5">{items.map(({ content }) => <div key={content.id} className="min-w-0"><ProgramCard id={content.id} title={content.title} src={content.thumbnail} alt={content.title} slug={`programs/${content.id}`} href={`/programs/${content.id}`} /><div className="mt-3"><MyListButton content={content.id} /></div></div>)}</div>}</div>;
}

export function LibraryPage({ kind }: { kind: "saved" | "progress" }) {
  const { user, loading } = useAuth();
  return <div className="py-6 md:py-9"><div className="content-section"><Link href="/channels" className="mb-4 inline-flex min-h-11 items-center text-sm text-white/65 hover:text-teal-300">Back to Channel Box</Link><h1 className="text-3xl font-semibold">{kind === "saved" ? "My List" : "Your viewing history"}</h1></div>{loading ? <p className="content-section" role="status">Loading your account…</p> : !user ? <div className="content-section"><p className="text-white/65">Sign in to see {kind === "saved" ? "your saved titles" : "your unfinished titles"}.</p><Link href="/sign-in" className="primary-action mt-5">Sign in</Link></div> : kind === "saved" ? <SavedTitles /> : <ContinueWatchingRail showEmpty />}</div>;
}
