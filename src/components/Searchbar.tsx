
import { Search } from 'lucide-react';
import MeiliSearch from 'meilisearch';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SearchResultItem {
  id: string | number;
  title: string;
  description: string;
}

interface MeiliSearchHit {
  id: string | number;
  title: string;
  description?: string;
}

const meilisearchHost = process.env.NEXT_PUBLIC_MEILISEARCH_URL;
const meilisearchApiKey = process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY;

if (!meilisearchHost || !meilisearchApiKey) {
  throw new Error(
    "Missing MeiliSearch environment variables. Please set NEXT_PUBLIC_MEILISEARCH_URL and NEXT_PUBLIC_MEILISEARCH_API_KEY."
  );
}

const client = new MeiliSearch({
  host: meilisearchHost!,
  apiKey: meilisearchApiKey!,
});

const index = client.index('content');

export const Searchbar = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      if (searchTerm) {
        const searchResult = await index.search(searchTerm);
        setResults(searchResult.hits.map((hit) => {
          const meiliHit = hit as MeiliSearchHit;
          return {
            id: meiliHit.id,
            title: meiliHit.title,
            description: meiliHit.description || '',
          };
        }));
      } else {
        setResults([]);
      }
    };


    performSearch();
  }, [searchTerm]);

  return (
    <div className="relative">
      <div className="rounded-lg bg-white/5 h-12 py-6 md:min-w-md capitalize bg-transparent relative flex items-center">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#444]" />
        <input
          type="text"
          placeholder="What are you looking for ?"
          className="w-full h-full absolute top-0 left-0 outline-none z-0 pl-12 bg-transparent text-white placeholder:text-[#444]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
      </div>
      {showDropdown && searchTerm && (
        <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-10">
          {results.length > 0 ? (
            <ul className="py-1">
              {results.map((hit) => (
                <li key={hit.id} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-black">
                  <Link href={`programs/${hit.id}`}><div className="font-normal">{hit.title}</div>
                    <div className="text-sm text-gray-600">{hit.description}</div></Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-2 text-black">No results found.</div>
          )}
        </div>
      )}
    </div>
  );
};
