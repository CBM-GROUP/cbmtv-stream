export const API_Routes = {
  /* Accounts */
  registerUser: "/api/accounts/register/",
  userLogin: "/api/accounts/login/",
  adminLogin: "/api/accounts/login/",
  userProfile: "/api/accounts/profile/",
  assignAdmin: "/api/accounts/assign-admin/",
  refreshToken: "/api/accounts/token/refresh/",
  getUsers: "/api/accounts/users/",

  /* Content */
  listContent: "/api/content/",
  createContent: "/api/content/",
  getContentById: "/api/content/{{content_id}}/",
  updateContent: "/api/content/{{new_content_id}}/",
  deleteContent: "/api/content/{{new_content_id}}/",

  /* Channels */
  createChannel: "/api/channels/",
  listChannels: "/api/channels/",
  getChannelById: "/api/channels/{{channel_id}}/",
  updateChannel: "/api/channels/{{channel_id}}/",
  deleteChannel: "/api/channels/{{channel_id}}/",
  /* Adverts */
  createAd: "/api/content/adverts/",
  listAds: "/api/content/adverts/",
  updateAd: "/api/content/adverts/{{advert_id}}/",
  deleteAd: "/api/content/adverts/3/",
  getAdById: "/api/content/adverts/{{advert_id}}/",

  /* Episodes */
  createEpisode: "/api/content/episodes/",
  updateEpisode: "/api/content/episodes/2/",
  getEpisodeById: "/api/content/episodes/2/",
  listEpisodesInSeason: "/api/content/episodes/?season=7",
  deleteEpisode: "/api/content/episodes/{{episode_id}}/",

  /* Seasons */
  listSeasonsBySeriesId: "/api/content/seasons/?content={{seriesID}}",
  createSeason: "/api/content/seasons/",
  updateSeason: "/api/content/seasons/{{season_id}}/",
  getSeasonById: "/api/content/seasons/{{season_id}}/",
  deleteSeason: "/api/content/seasons/{{season_id}}/",

  /* Series */
  listSeries: "/api/content/?content_type=series",
  getSeriesEpisodes: "/api/content/episodes/?season={{season_id}}",
  /* Movies */
  listMovies: "/api/content/movies/",
};
