/**
 * API contracts for the stream app.
 *
 * SOURCE OF TRUTH: the DRF serializers in cbmtv-backend-git. Each block names
 * the serializer it mirrors. All of them use `fields = '__all__'`, so the wire
 * shape is the model's field list.
 *
 * Two rules that this file previously broke:
 *   - `id` and foreign keys are NUMBERS. They were typed `string`, which made
 *     `program.channel === channel.id` a comparison that could never be right
 *     once one side came from a route param.
 *   - Nothing here may claim a field the API does not send. Anything the UI
 *     needs but the API does not provide belongs in the view-model section at
 *     the bottom, clearly marked as client-derived.
 */

/* ---------------------------------------------------------------------------
 * Enumerations -- content/models.py Content.CONTENT_TYPES / STATUS_TYPES
 * ------------------------------------------------------------------------ */

export type ContentType =
  | "movie"
  | "music"
  | "series"
  | "miniseries"
  | "original"
  | "documentary"
  | "animations";

export type ContentStatus = "preview" | "approved" | "rejected" | "comingsoon";

export type AdvertType = "hello" | "stream" | "middle" | "end";

export type UserRole = "user" | "admin" | "internal_admin";

export type AuthProvider = "local" | "google";

/**
 * A Django DurationField, serialized as "HH:MM:SS" (e.g. "00:26:40") -- not
 * minutes and not a number. Format it before display.
 */
export type DurationString = string;

/* ---------------------------------------------------------------------------
 * Pagination -- common/pagination.py StandardPagination
 * ------------------------------------------------------------------------ */

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Views that set `pagination_class` return PaginatedResponse; those that do not
 * (adverts, miniseries) return a bare array. Use normalizeListResponse.
 */
export type ListResponse<T> = T[] | PaginatedResponse<T>;

/* ---------------------------------------------------------------------------
 * Channel -- channel/serializers.py ChannelSerializer
 * ------------------------------------------------------------------------ */

export interface Channel {
  id: number;
  name: string;
  description: string;
  /** Null until an editor uploads one. */
  logo_url: string | null;
  cover_image_url: string | null;
}

export interface CreateChannelData {
  name: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
}

export type UpdateChannelData = Partial<CreateChannelData>;

/* ---------------------------------------------------------------------------
 * Content -- content/serializers.py ContentSerializer
 *
 * Named `Program` throughout this app for historical reasons; it is the
 * backend's Content model.
 * ------------------------------------------------------------------------ */

export interface Program {
  id: number;
  title: string;
  description: string;
  content_type: ContentType;
  trailer_link: string | null;
  streaming_link: string | null;
  thumbnail: string | null;
  size: string | null;
  duration: DurationString | null;
  director: string | null;
  writer: string | null;
  genre: string | null;
  country: string | null;
  status: ContentStatus | null;
  /** Foreign key id, not an embedded object. */
  channel: number;
  created_at: string;
}

/** Alias for code that would rather say what the backend says. */
export type Content = Program;

export interface CreateContentData {
  title: string;
  description?: string;
  content_type: ContentType;
  channel: number;
  trailer_link?: string | null;
  streaming_link?: string | null;
  thumbnail?: string | null;
  size?: string | null;
  duration?: DurationString | null;
  director?: string | null;
  writer?: string | null;
  genre?: string | null;
  country?: string | null;
  status?: ContentStatus | null;
}

export type UpdateContentData = Partial<CreateContentData>;

/* ---------------------------------------------------------------------------
 * Season / Episode / MiniSeries -- content/serializers.py
 * ------------------------------------------------------------------------ */

export interface Season {
  id: number;
  content: number;
  title: string;
  season_number: number;
  description: string;
  trailer_link: string | null;
  thumbnail: string | null;
}

export interface CreateSeasonData {
  content: number;
  title: string;
  season_number: number;
  description?: string;
  trailer_link?: string | null;
  thumbnail?: string | null;
}

export type UpdateSeasonData = Partial<CreateSeasonData>;

export interface Episode {
  id: number;
  season: number;
  title: string;
  episode_number: number;
  streaming_link: string | null;
  duration: DurationString | null;
  thumbnail: string | null;
}

export interface CreateEpisodeData {
  season: number;
  title: string;
  episode_number: number;
  streaming_link?: string | null;
  duration?: DurationString | null;
  thumbnail?: string | null;
}

export type UpdateEpisodeData = Partial<CreateEpisodeData>;

export interface MiniSeries {
  id: number;
  content: number;
  title: string;
  miniseries_no: number;
  streaming_link: string | null;
  duration: DurationString | null;
  thumbnail: string | null;
}

/* ---------------------------------------------------------------------------
 * Advert -- content/serializers.py ContentAdvertSerializer
 * (model: content.models.contentadverts)
 * ------------------------------------------------------------------------ */

export interface Advert {
  id: number;
  advert_type: AdvertType;
  advert_name: string | null;
  advert_description: string | null;
  advert_link: string | null;
  stream_link: string | null;
  advert_thumbnail: string | null;
}

export interface CreateAdData {
  advert_type: AdvertType;
  advert_name?: string | null;
  advert_description?: string | null;
  advert_link?: string | null;
  stream_link?: string | null;
  advert_thumbnail?: string | null;
}

export type UpdateAdData = Partial<CreateAdData>;

/* ---------------------------------------------------------------------------
 * Accounts -- accounts/serializers.py
 * ------------------------------------------------------------------------ */

/**
 * RegisterSerializer. phone / location / country / image are optional: the
 * model marks them blank=True, null=True, so DRF makes them not required.
 *
 * The field is `phone`. This app used to send `phone_number`, which the
 * serializer ignored.
 */
export interface RegisterData {
  email: string;
  name: string;
  password: string;
  phone?: string;
  location?: string;
  country?: string;
  image?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

/** The decoded Google identity POSTed to /login/google/direct/. */
export interface GoogleDirectLoginData {
  email: string;
  google_id: string;
  name?: string;
}

/** UserProfileSerializer, and the nested `user` block on the login response. */
export interface User {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  location: string | null;
  country: string | null;
  image: string | null;
  role?: UserRole;
  auth_provider?: AuthProvider;
  is_staff?: boolean;
  is_superuser?: boolean;
}

/**
 * GET /api/accounts/profile/ uses UserSerializer, which adds a `username`
 * SerializerMethodField mapped to `name`.
 */
export interface UserProfile extends User {
  username?: string;
}

/** CustomTokenObtainPairSerializer. */
export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

/** GoogleDirectLoginView additionally reports whether the account was created. */
export interface GoogleLoginResponse extends LoginResponse {
  login: "register" | "login";
}

export interface RefreshResponse {
  access: string;
}

export interface AssignAdminData {
  user_id: number;
  role: "admin" | "internal_admin";
}

/**
 * DRF field errors: `{ "email": ["user with this email already exists."] }`,
 * or `{ "detail": "..." }` for non-field errors.
 */
export interface ApiFieldErrors {
  detail?: string;
  [field: string]: string | string[] | undefined;
}

/* ---------------------------------------------------------------------------
 * View models -- CLIENT-DERIVED, not API shapes.
 *
 * These exist so the UI can carry presentation fields without pretending the
 * backend sends them.
 * ------------------------------------------------------------------------ */

/** What ProgramCard / ProgramGrid render. Derived from a Program. */
export interface ProgramCardItem {
  id: number;
  title: string;
  /** Program.thumbnail, already defaulted for rendering. */
  src: string | null;
  alt: string;
  /** Route path, e.g. "programs/6". */
  slug: string;
  /** Whatever the grid filters on -- currently content_type. */
  genre?: string;
}

/** What ChannelCarousel / ChannelSwiper render. Derived from a Channel. */
export interface ChannelCardItem {
  title: string;
  src: string;
  href: string;
}
