export interface RegisterData {
  email: string;
  name: string;
  phone_number: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AssignAdminData {
  user_id: string;
}

export interface CreateAdData {
  title: string;
  video_url: string;
}

export interface UpdateAdData {
  title?: string;
  video_url?: string;
}

export interface CreateChannelData {
  name: string;
  description: string;
  logo_url: string;
  cover_image_url: string;
}

export interface UpdateChannelData {
  name?: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
}

export interface CreateContentData {
  title: string;
  description: string;
  poster_url: string;
  video_url: string;
  content_type: string;
  channel_id: string;
  genres: string[];
}

export interface UpdateContentData {
  title?: string;
  description?: string;
  poster_url?: string;
  video_url?: string;
  content_type?: string;
  channel_id?: string;
  genres?: string[];
}

export interface CreateEpisodeData {
  title: string;
  description: string;
  video_url: string;
  season_id: string;
}

export interface UpdateEpisodeData {
  title?: string;
  description?: string;
  video_url?: string;
  season_id?: string;
}

export interface CreateSeasonData {
  title: string;
  series_id: string;
}

export interface UpdateSeasonData {
  title?: string;
  series_id?: string;
}

export interface Advert {
  id: number;
  advert_type: string;
  advert_name: string;
  advert_description: string;
  advert_link: string;
  stream_link: string;
  advert_thumbnail: string;
}

export interface Program {
  id: string;
  content_type: string;
  channel: string;
  title: string;
  description: string;
  thumbnail: string;
  streaming_link: string;
  trailer_link?: string;
  duration: string;
  director: string;
  writer?: string; 
  genre?: string;
  size?: string;
}
