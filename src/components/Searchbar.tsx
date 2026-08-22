"use client";

import { Loader2, Search, SearchX, TriangleAlert } from "lucide-react";
import MeiliSearch from "meilisearch";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

interface SearchResultItem {
  id: string | number;
  title: string;
  description: string;
}

interface MeiliSearchHit {
  id: string | number;
  title: string;
  // The backend only pushes id/title/genres into the index, so description is
  // usually absent. Rendered only when it actually has content.
  description?: string;
}

const MAX_RESULTS = 8;
const DEBOUNCE_MS = 250;

const meilisearchHost = process.env.NEXT_PUBLIC_MEILISEARCH_URL;
const meilisearchApiKey = process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY;

// Previously this module threw at evaluation time when the env vars were
// missing, which took down every page that imports the NavBar. Degrade to a
// disabled input instead.
const client =
  meilisearchHost && meilisearchApiKey
    ? new MeiliSearch({ host: meilisearchHost, apiKey: meilisearchApiKey })
    : null;

type Status = "idle" | "loading" | "ready" | "error";

export const Searchbar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  // Monotonic id so a slow early response can never overwrite a newer one.
  const requestIdRef = useRef(0);

  const query = searchTerm.trim();
  const index = useMemo(() => client?.index("content") ?? null, []);

  useEffect(() => {
    if (!query) {
      requestIdRef.current += 1; // cancel any in-flight response
      setResults([]);
      setStatus("idle");
      return;
    }

    if (!index) {
      setStatus("error");
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus("loading");

    const timer = setTimeout(async () => {
      try {
        const searchResult = await index.search(query, { limit: MAX_RESULTS });
        if (requestId !== requestIdRef.current) return; // stale
        setResults(
          searchResult.hits.map((hit) => {
            const meiliHit = hit as MeiliSearchHit;
            return {
              id: meiliHit.id,
              title: meiliHit.title,
              description: meiliHit.description ?? "",
            };
          })
        );
        setStatus("ready");
      } catch {
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, index]);

  // Reset the highlighted row whenever the result set changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

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
    if (!isOpen || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      const hit = results[activeIndex];
      if (hit) {
        window.location.href = `/programs/${hit.id}`;
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="rounded-lg bg-white/5 h-12 py-6 md:min-w-md capitalize bg-transparent relative flex items-center">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#444]" />
        <input
          type="text"
          placeholder="What are you looking for ?"
          className="w-full h-full absolute top-0 left-0 outline-none z-0 pl-12 pr-10 bg-transparent text-white placeholder:text-[#444]"
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
          aria-controls="search-results"
          aria-autocomplete="list"
        />
        {status === "loading" && (
          <Loader2
            className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#666]"
            aria-hidden="true"
          />
        )}
      </div>

      {isOpen && (
        <div
          id="search-results"
          role="listbox"
          className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-10 overflow-hidden"
        >
          {status === "loading" && results.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Searching…
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-2 px-4 py-3 text-sm text-red-600">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>Search is unavailable right now. Please try again later.</span>
            </div>
          )}

          {status === "ready" && results.length === 0 && (
            <div className="flex items-start gap-2 px-4 py-3 text-sm text-gray-500">
              <SearchX className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                No results for <span className="font-medium text-gray-700">“{query}”</span>
              </span>
            </div>
          )}

          {results.length > 0 && (
            <ul className="py-1 max-h-80 overflow-y-auto">
              {results.map((hit, i) => (
                <li key={hit.id} role="option" aria-selected={i === activeIndex}>
                  <Link
                    href={`/programs/${hit.id}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => setShowDropdown(false)}
                    className={`block px-4 py-2 cursor-pointer text-black ${
                      i === activeIndex ? "bg-gray-100" : "hover:bg-gray-100"
                    }`}
                  >
                    <div className="font-normal line-clamp-1">{hit.title}</div>
                    {hit.description && (
                      <div className="text-sm text-gray-600 line-clamp-1">
                        {hit.description}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {status === "loading"
          ? "Searching"
          : status === "error"
            ? "Search unavailable"
            : status === "ready"
              ? `${results.length} result${results.length === 1 ? "" : "s"}`
              : ""}
      </span>
    </div>
  );
};
