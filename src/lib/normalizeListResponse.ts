/**
 * Unwrap a DRF list payload into a plain array.
 *
 * The API is not consistent about this: views that set `pagination_class`
 * (content, channels, movies, seasons, episodes) return
 * `{count, next, previous, results}`, while those that do not (adverts,
 * miniseries) return a bare array. Callers should not have to know which is
 * which.
 *
 * Ported from the dashboard's src/services/normalizeListResponse.ts so all
 * three clients share one behaviour rather than three near-copies.
 */
export function normalizeListResponse<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === "object" && "results" in data) {
    const { results } = data as { results?: unknown };
    return Array.isArray(results) ? (results as T[]) : [];
  }

  return [];
}
