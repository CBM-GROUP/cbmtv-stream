/**
 * Every backend path the stream app knows about.
 *
 * Paths carry `{{token}}` placeholders and are resolved through `buildPath`,
 * never by string surgery at the call site. Four routes used to embed a real
 * record id -- `adverts/3/`, `episodes/2/` twice, and `?season=7` -- which
 * services patched with a trailing-digits regex:
 *
 *     API_Routes.deleteAd.replace(/(\d+)\/$/, `${id}/`)
 *
 * That is a live hazard in two directions. Forget the `.replace` and
 * `deleteAd()` deletes advert 3. Apply it to a path that holds a token rather
 * than digits and the regex quietly matches nothing -- which is exactly what
 * `getSeasonById` did, requesting the literal `/api/content/seasons/{{season_id}}/`.
 *
 * `buildPath` removes both failure modes: it substitutes by name and throws if
 * any placeholder survives, so a missed parameter is a loud error instead of a
 * request against a fixed record.
 */
export const API_Routes = {
  /* Accounts */
  registerUser: "/api/accounts/register/",
  userLogin: "/api/accounts/login/",
  adminLogin: "/api/accounts/login/",
  googleDirectLogin: "/api/accounts/login/google/direct/",
  userProfile: "/api/accounts/profile/",
  assignAdmin: "/api/accounts/assign-admin/",
  refreshToken: "/api/accounts/token/refresh/",
  getUsers: "/api/accounts/users/",
  updateUser: "/api/accounts/users/{{user_id}}/",
  changeUserPassword: "/api/accounts/users/{{user_id}}/password/",

  /* Content */
  listContent: "/api/content/",
  createContent: "/api/content/",
  getContentById: "/api/content/{{content_id}}/",
  updateContent: "/api/content/{{content_id}}/",
  deleteContent: "/api/content/{{content_id}}/",
  contentIds: "/api/content/ids/",

  /* Search (read-only) and the administrative reindex it was split out of. */
  searchContent: "/api/content/search/",
  reindexContent: "/api/content/reindex/",

  /* Channels */
  createChannel: "/api/channels/",
  listChannels: "/api/channels/",
  getChannelById: "/api/channels/{{channel_id}}/",
  updateChannel: "/api/channels/{{channel_id}}/",
  deleteChannel: "/api/channels/{{channel_id}}/",
  listChannelContents: "/api/channels/{{channel_id}}/contents/",

  /* Adverts */
  createAd: "/api/content/adverts/",
  listAds: "/api/content/adverts/",
  heroSettings: "/api/content/hero-settings/",
  getAdById: "/api/content/adverts/{{advert_id}}/",
  updateAd: "/api/content/adverts/{{advert_id}}/",
  deleteAd: "/api/content/adverts/{{advert_id}}/",

  /* Episodes */
  createEpisode: "/api/content/episodes/",
  listEpisodesInSeason: "/api/content/episodes/?season={{season_id}}",
  getEpisodeById: "/api/content/episodes/{{episode_id}}/",
  updateEpisode: "/api/content/episodes/{{episode_id}}/",
  deleteEpisode: "/api/content/episodes/{{episode_id}}/",

  /* Miniseries parts */
  listMiniSeriesByContentId: "/api/content/miniseries/?content={{content_id}}",

  /* Seasons */
  listSeasonsBySeriesId: "/api/content/seasons/?content={{content_id}}",
  createSeason: "/api/content/seasons/",
  getSeasonById: "/api/content/seasons/{{season_id}}/",
  updateSeason: "/api/content/seasons/{{season_id}}/",
  deleteSeason: "/api/content/seasons/{{season_id}}/",

  /* Series / movies. `?content_type=` is honoured by the backend as of the
     Track 0A filter fix; before that this route returned the whole catalogue. */
  listSeries: "/api/content/?content_type=series",
  listMovies: "/api/content/movies/",
} as const;

export type ApiRoute = (typeof API_Routes)[keyof typeof API_Routes];

const TOKEN_PATTERN = /\{\{(\w+)\}\}/;

/**
 * Resolve a route template against named parameters.
 *
 * Throws rather than returning a half-substituted path, so a forgotten
 * parameter can never reach the network as a request against whatever record
 * the literal happened to name.
 */
export function buildPath(
  template: string,
  params: Record<string, string | number> = {},
): string {
  let path = template;

  for (const [key, rawValue] of Object.entries(params)) {
    const value = String(rawValue).trim();
    if (!value) {
      throw new Error(
        `buildPath: empty value for "${key}" while resolving "${template}".`,
      );
    }
    path = path.split(`{{${key}}}`).join(encodeURIComponent(value));
  }

  const leftover = path.match(TOKEN_PATTERN);
  if (leftover) {
    throw new Error(
      `buildPath: unresolved placeholder "{{${leftover[1]}}}" in "${template}". ` +
        `Pass it in the params object.`,
    );
  }

  return path;
}
