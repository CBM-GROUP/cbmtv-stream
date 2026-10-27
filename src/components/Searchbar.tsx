"use client";

import { Loader2, Search, SearchX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { SafeImage } from "@/components/SafeImage";
import { useSearch } from "@/hooks/useSearch";

const MAX_RESULTS = 8;
const DEBOUNCE_MS = 250;

/**
 * Catalogue search.
 *
 * This component used to build a MeiliSearch client in the browser from
 * `NEXT_PUBLIC_MEILISEARCH_URL` / `NEXT_PUBLIC_MEILISEARCH_API_KEY` and query
 * the search engine directly. Two problems with that, both now gone:
 *
 *   1. The key shipped to every visitor was the Meilisearch *master* key, so
 *      anyone reading the bundle could delete the index.
 *   2. It rendered index documents as results. When the index drifted from the
 *      database -- which it had -- a hit linked to whatever programme happened
 *      to own that id, or to a 404.
 *
 * It now calls `GET /api/content/search/`, which ranks through Meilisearch but
 * returns rows read from the database, and falls back to a database query when
 * the index cannot answer. See src/services/search.ts.
 *
 * Debouncing stays here rather than in the hook: the keystroke rate is a UI
 * concern, and React Query keys off the settled term.
 */
export const Searchbar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const resultsId = useId();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const query = searchTerm.trim();

  // Settle the term before it becomes a query key. Clearing the input resets
  // immediately, so the dropdown never shows stale results for 250ms.
  useEffect(() => {
    if (!query) {
      setDebouncedTerm("");
      return;
    }
    const timer = setTimeout(() => setDebouncedTerm(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isPending, isError, isFetching } = useSearch(
    debouncedTerm,
    MAX_RESULTS,
  );

  const results = data?.hits ?? [];

  // Three distinct states the dropdown has to tell apart:
  //   searching -- a term is typed but no settled result set exists yet, which
  //                includes the debounce window before any request is sent.
  //   error     -- the request failed.
  //   settled   -- a response arrived; zero results now means "no matches".
  // `isPending` is React Query's "no data yet", and it also stays true for a
  // disabled query, hence the explicit term checks.
  const isDebouncing = Boolean(query) && query !== debouncedTerm;
  const isSearching =
    isDebouncing || (Boolean(debouncedTerm) && (isPending || isFetching));
  const hasSettled = Boolean(debouncedTerm) && !isSearching && !isError;

  // Reset the highlighted row when the term or result count changes. A cached
  // response can refresh after the user presses ArrowDown; resetting on every
  // data object update would unexpectedly clear their keyboard selection.
  useEffect(() => {
    setActiveIndex(-1);
  }, [query, results.length]);

  // Close on outside click. More reliable than an onBlur timeout, which raced
  // with clicking a result.
  useEffect(() => {
    if (!showDropdown) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [showDropdown]);

  const isOpen = showDropdown && Boolean(query);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setShowDropdown(false);
      return;
    }
    if (!isOpen || isSearching || isError || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      const hit = results[activeIndex];
      if (hit) {
        event.preventDefault();
        setShowDropdown(false);
        onNavigate?.();
        // router.push, not window.location.href: a full document reload threw
        // away the React tree and replayed the 3s Preloader on every result.
        router.push(`/programs/${hit.id}`);
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative mt-4 flex h-12 items-center rounded-md bg-white/10">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search titles or genres"
          aria-label="Search titles or genres"
          className="absolute top-0 left-0 h-full w-full rounded-md bg-transparent pl-12 pr-10 text-base text-white placeholder:text-white/50"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            // Typing must reopen the dropdown: Escape closes it while the
            // input keeps focus, so onFocus alone would never fire again.
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? resultsId : undefined}
          aria-activedescendant={activeIndex >= 0 && !isSearching ? `${resultsId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
        />
        {isSearching && (
          <Loader2
            className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#666]"
            aria-hidden="true"
          />
        )}
      </div>

      {isOpen && (
        <div
          id={resultsId}
          role="listbox"
          className="mt-3 w-full overflow-hidden rounded-lg bg-white text-black"
        >
          {isSearching && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Searching…
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-2 px-4 py-3 text-sm text-red-600">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>Search is unavailable right now. Please try again later.</span>
            </div>
          )}

          {hasSettled && results.length === 0 && (
            <div className="flex items-start gap-2 px-4 py-3 text-sm text-gray-500">
              <SearchX className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                No results for{" "}
                <span className="font-medium text-gray-700">{query}</span>
              </span>
            </div>
          )}

          {!isSearching && !isError && results.length > 0 && (
            <ul className="search-result-list overflow-y-auto py-1">
              {results.map((hit, i) => (
                <li key={hit.id} id={`${resultsId}-${i}`} role="option" aria-selected={i === activeIndex}>
                  <Link
                    href={`/programs/${hit.id}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => { setShowDropdown(false); onNavigate?.(); }}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer text-black ${
                      i === activeIndex ? "bg-gray-100" : "hover:bg-gray-100"
                    }`}
                  >
                    {/*
                      A hit is a real Content row now, so a thumbnail is
                      available. SafeImage covers the broken-URL case; the
                      wrapper keeps row height stable when there is no image.
                    */}
                    <span className="h-10 w-16 shrink-0 overflow-hidden rounded bg-gray-200">
                      {hit.thumbnail && (
                        <SafeImage
                          src={hit.thumbnail}
                          alt=""
                          width={64}
                          height={40}
                          className="h-10 w-16 object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-normal line-clamp-1">
                        {hit.title}
                      </span>
                      <span className="block text-sm text-gray-600 line-clamp-1">
                        {[hit.content_type, hit.genre].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {isSearching
          ? "Searching"
          : isError
            ? "Search unavailable"
            : hasSettled
              ? `${results.length} result${results.length === 1 ? "" : "s"}`
              : ""}
      </span>
    </div>
  );
};
