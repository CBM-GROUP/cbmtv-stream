import type { Program } from '@/types';
import type { AdSession, Advertisement } from '@/services/advertising';

export type FeaturedSlide = { kind: 'movie'; movie: Program } | { kind: 'advert'; session: AdSession; ad: Advertisement; after: number };

export function insertFeaturedAdverts(titles: Program[], adverts: Map<number, { session: AdSession; ad: Advertisement }>, interval: number): FeaturedSlide[] {
  const slides: FeaturedSlide[] = [];
  titles.forEach((movie, index) => {
    slides.push({ kind: 'movie', movie });
    const after = index + 1;
    const selection = adverts.get(after);
    if (after % interval === 0 && selection) slides.push({ kind: 'advert', ...selection, after });
  });
  return slides;
}
