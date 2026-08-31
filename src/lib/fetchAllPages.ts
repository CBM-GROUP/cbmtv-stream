import type { AxiosInstance } from "axios";

import { normalizeListResponse } from "./normalizeListResponse";

/**
 * Fetch every page of a DRF list endpoint.
 *
 * `common/pagination.py` sets page_size=10 (and now caps it at 100), so a bare
 * GET returns only the first ten rows plus a `next` URL. Reading `results` and
 * stopping there -- what every list service here used to do -- silently
 * truncates the catalogue while `count` still reports the true total. It looks
 * correct today only because there are five content rows.
 *
 * Walking `next` is the fix rather than asking for `page_size=100`, which just
 * moves the cliff instead of removing it.
 *
 * `next` comes back as an absolute URL built from the request host, so it is
 * passed to axios as-is; axios ignores `baseURL` for absolute URLs.
 *
 * `maxPages` is a safety valve against a server that returns a self-referential
 * `next`. At the default page size it admits 500 rows.
 *
 * Ported from the dashboard's src/services/fetchAllPages.ts.
 */
export async function fetchAllPages<T>(
  client: AxiosInstance,
  path: string,
  maxPages = 50,
): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = path;
  let pages = 0;

  while (url && pages < maxPages) {
    const response = await client.get(url);
    items.push(...normalizeListResponse<T>(response.data));

    const body = response.data as { next?: unknown } | null;
    url = body && typeof body === "object" && typeof body.next === "string" ? body.next : null;
    pages += 1;
  }

  return items;
}
