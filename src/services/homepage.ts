import { publicApiClient } from './api';
import { viewerRequest, ViewerSessionChangedError } from './viewer-api';
import type { Channel, Program } from '@/types';

export type Progress = {
  id: number; content: Program; episode: number | null; miniseries: number | null;
  position_seconds: number; duration_seconds: number; completed: boolean; updated_at: string;
};
type SectionBase = { label: string; enabled: boolean; source: 'editorial' | 'automatic' | 'personalized' | 'advertising' };
export type HomepageSection = SectionBase & (
  { id: 'homepage_banner' | 'homepage_sponsored_section' | 'homepage_featured_sponsor' | 'homepage_channel_promotion' | 'homepage_content_promotion'; items: Program[] } |
  { id: 'featured_channels'; items: Channel[] } |
  { id: 'continue_watching'; items: Progress[] } |
  { id: 'featured_hero' | 'new_releases' | 'tv_shows' | 'movies' | 'documentaries' | 'animations'; items: Program[] }
);
export type Homepage = { sections: HomepageSection[] };

export async function getHomepage(userId: number | undefined, signal?: AbortSignal): Promise<Homepage> {
  if (userId) {
    try { return (await viewerRequest<Homepage>(userId, { url: '/api/homepage/', signal })).data; }
    catch (cause) { if (!(cause instanceof ViewerSessionChangedError)) throw cause; }
  }
  return (await publicApiClient.get('/api/homepage/', { signal })).data;
}
