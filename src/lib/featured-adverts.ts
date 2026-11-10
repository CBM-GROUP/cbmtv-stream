import type { Program } from '@/types';
import type { AdSession, Advertisement } from '@/services/advertising';

export type FeaturedSlide = { kind: 'movie'; movie: Program } | { kind: 'advert'; session: AdSession; ad: Advertisement; after: number };

export function insertFeaturedAdverts(titles: Program[], adverts: Map<number, { session: AdSession; ad: Advertisement }>, interval: number): FeaturedSlide[] {
  const slides: FeaturedSlide[] = [];
  let movieCount = 0;
  titles.forEach((movie) => {
    slides.push({ kind: 'movie', movie });
    if (movie.content_type !== 'movie') return;
    const after = ++movieCount;
    const selection = adverts.get(after);
    if (after % interval === 0 && selection) slides.push({ kind: 'advert', ...selection, after });
  });
  return slides;
}

export function reconcileFeaturedIndex(previous: FeaturedSlide[], slides: FeaturedSlide[], index: number): number {
  const prior = previous[index];
  const matching = prior ? slides.findIndex(slide => slide.kind === prior.kind &&
    (slide.kind === 'movie' && prior.kind === 'movie' ? slide.movie.id === prior.movie.id :
      slide.kind === 'advert' && prior.kind === 'advert' && slide.ad.decision_id === prior.ad.decision_id)) : -1;
  return matching >= 0 ? matching : Math.min(index, Math.max(0, slides.length - 1));
}
