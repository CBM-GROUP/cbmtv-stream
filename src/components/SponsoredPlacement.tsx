'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ProgramCard } from './ProgramCard';
import { openAdSession, decideAd, recordAdEvent, approvedAdHref, type AdContext, type AdSession, type Advertisement } from '@/services/advertising';

export function SponsoredPlacement({ placement, context, content, channel }: AdContext & { placement: string }) {
  const { user } = useAuth();
  const [result, setResult] = useState<{ key: string; session: AdSession; ad: Advertisement } | null>(null);
  const element = useRef<HTMLElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const key = `${user?.id ?? 'anonymous'}:${placement}:${context}:${content ?? ''}:${channel ?? ''}`;
  const active = result?.key === key ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    void openAdSession({ context, content, channel }, user?.id, controller.signal).then(async session => {
      const ad = await decideAd(session, placement, 'once', user?.id, controller.signal);
      if (!controller.signal.aborted && ad?.kind === 'image') setResult({ key, session, ad });
    }).catch(() => {});
    return () => controller.abort();
  }, [key, context, content, channel, placement, user?.id]);

  useEffect(() => {
    if (!active || !element.current) return;
    let visible = false;
    let loaded = Boolean(image.current?.complete && image.current.naturalWidth);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reported = false;
    const check = () => {
      clearTimeout(timer);
      if (visible && loaded && document.visibilityState === 'visible' && !reported) timer = setTimeout(() => {
        reported = true;
        void recordAdEvent(active.session, active.ad, 'impression', 0, user?.id);
      }, 1100);
    };
    const onLoad = () => { loaded = true; check(); };
    const observer = new IntersectionObserver(entries => { visible = entries[0].intersectionRatio >= .5; check(); }, { threshold: [.5] });
    observer.observe(element.current);
    const currentImage = image.current;
    currentImage?.addEventListener('load', onLoad);
    document.addEventListener('visibilitychange', check);
    check();
    return () => { observer.disconnect(); clearTimeout(timer); currentImage?.removeEventListener('load', onLoad); document.removeEventListener('visibilitychange', check); };
  }, [active, user?.id]);

  if (!active) return null;
  const { ad, session } = active;
  const href = approvedAdHref(ad);
  const artwork = <picture><source media="(max-width: 640px)" srcSet={ad.mobile_url || ad.url} />
    {/* Optimized, metadata-free WebP derivatives already have immutable caching. */}
    <img ref={image} src={ad.url} width={ad.width} height={ad.height} alt={ad.name} className="max-h-48 w-full rounded-lg object-contain sm:max-h-64" loading="lazy" onError={() => { void recordAdEvent(session, ad, 'failure', 0, user?.id); setResult(null); }} />
  </picture>;
  return <section ref={element} aria-label="Sponsored placement" className="content-section min-w-0 rounded-xl border border-white/10 p-3 sm:p-4">
    <p className="mb-2 truncate text-xs text-white/60" title={ad.advertiser}>Sponsored · {ad.advertiser}</p>
    {href ? <a href={href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => void recordAdEvent(session, ad, 'click', 0, user?.id)}>{artwork}<span className="mt-2 inline-flex min-h-11 items-center text-sm text-teal-300">{ad.cta || 'Learn more'}</span></a> : artwork}
    {ad.promoted_content && <Link className="inline-flex min-h-11 items-center text-sm text-teal-300" href={`/programs/${ad.promoted_content}`} onClick={() => void recordAdEvent(session, ad, 'click', 0, user?.id)}>Explore sponsored title</Link>}
    {ad.promoted_channel && <Link className="ml-3 inline-flex min-h-11 items-center text-sm text-teal-300" href={`/channels/${ad.promoted_channel}`} onClick={() => void recordAdEvent(session, ad, 'click', 0, user?.id)}>Explore sponsored channel</Link>}
    {Boolean(ad.sponsored_items?.length) && <div className="content-rail h-scroll mt-3" aria-label="Sponsored collection" tabIndex={0}>{ad.sponsored_items?.map(item => <div key={item.id} className="rail-card"><ProgramCard id={item.id} title={item.title} src={item.thumbnail} alt={item.title} slug={`programs/${item.id}`} href={`/programs/${item.id}`} onClick={() => void recordAdEvent(session, ad, 'click', 0, user?.id)} /></div>)}</div>}
  </section>;
}
