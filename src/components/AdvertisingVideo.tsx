'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { TrackedVideo } from './TrackedVideo';
import { openAdSession, decideAd, recordAdEvent, approvedAdHref, type AdSession, type Advertisement, type AdEvent } from '@/services/advertising';

type MainProps = ComponentProps<typeof TrackedVideo>;
type Props = MainProps & { advertisingEnabled?: boolean; viewerId?: number; playbackSessionId?: string };
type State = { session: AdSession | null; attempted: Set<string>; position: number; ended: boolean };
// Bound to an authorized playback session, survives signed URL renewals and
// component remounts. No cookies, browser identifiers, or cross-tab profiling.
const sessions = new Map<string, State>();
function playbackState(key: string, start: number): State {
  let state = sessions.get(key);
  if (!state) {
    state = { session: null, attempted: new Set(), position: start, ended: false };
    sessions.set(key, state);
    if (sessions.size > 40) sessions.delete(sessions.keys().next().value as string);
  }
  return state;
}

function VideoAdvertisement({ ad, session, viewerId, done }: { ad: Advertisement; session: AdSession; viewerId: number; done: () => void }) {
  const [position, setPosition] = useState(0);
  const sent = useRef(new Set<AdEvent>());
  const sending = useRef(new Set<AdEvent>());
  const container = useRef<HTMLDivElement>(null);
  const visible = useRef(false);
  const openedAt = useRef(performance.now());
  const startedAt = useRef<number | null>(null);
  const impressionAt = useRef<number | null>(null);
  const ended = useRef(false);
  const playing = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { visible.current = entries[0].intersectionRatio >= .5; if (!visible.current) impressionAt.current = null; }, { threshold: [.5] });
    if (container.current) observer.observe(container.current);
    const visibility = () => { if (document.visibilityState !== 'visible') impressionAt.current = null; };
    document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const emit = (kind: AdEvent, seconds: number) => {
    if (sent.current.has(kind) || sending.current.has(kind)) return;
    sending.current.add(kind);
    void recordAdEvent(session, ad, kind, seconds, viewerId).then(accepted => {
      sending.current.delete(kind);
      if (accepted) sent.current.add(kind);
    });
  };
  const finish = (kind: 'complete' | 'failure' | 'skip', seconds: number) => {
    if (ended.current) return;
    ended.current = true;
    emit(kind, seconds);
    done();
  };
  const progress = (seconds: number, duration: number) => {
    if (!Number.isFinite(seconds) || !Number.isFinite(duration)) return;
    setPosition(seconds);
    const video = container.current?.querySelector('video');
    const now = performance.now();
    const qualifies = visible.current && playing.current && document.visibilityState === 'visible' && !video?.paused && startedAt.current !== null;
    if (qualifies && impressionAt.current === null) impressionAt.current = now;
    if (!qualifies) impressionAt.current = null;
    if (qualifies && seconds >= 2 && impressionAt.current !== null && now - impressionAt.current >= 2000) emit('impression', seconds);
    if (!sent.current.has('impression')) return;
    for (const [kind, fraction] of [['first_quartile', .25], ['midpoint', .5], ['third_quartile', .75]] as const) {
      if (seconds >= (ad.duration_seconds ?? duration) * fraction) emit(kind, seconds);
    }
  };
  const href = approvedAdHref(ad);
  return <div ref={container} className="absolute inset-0">
    <TrackedVideo src={ad.url} sourceType={ad.source_type} withCredentials={ad.with_credentials} advertisement
      onPlaybackState={value => {
        playing.current = value;
        if (!value) impressionAt.current = null;
        if (value && startedAt.current === null) {
          startedAt.current = performance.now();
          window.dispatchEvent(new CustomEvent('cbmtv:advertising-metric', { detail: { kind: 'startup', duration_ms: performance.now() - openedAt.current } }));
        }
        if (value) emit('video_start', 0);
      }} onPlay={() => {}} onProgress={progress} onEnded={() => finish('complete', ad.duration_seconds ?? position)} onError={() => finish('failure', position)} />
    <div className="pointer-events-none absolute left-3 right-16 top-3 flex flex-wrap items-center gap-2 text-xs text-white">
      <span className="max-w-full truncate rounded bg-black/80 px-2 py-1" title={ad.advertiser}>Advertisement · {ad.advertiser}</span>
      {ad.duration_seconds && <span className="rounded bg-black/80 px-2 py-1" aria-live="off">{Math.max(0, Math.ceil(ad.duration_seconds - position))}s remaining</span>}
    </div>
    <div className="absolute bottom-14 right-3 flex max-w-[80%] flex-wrap justify-end gap-2 text-sm">
      {href && <a className="flex min-h-11 min-w-0 max-w-48 items-center rounded-md bg-black/85 px-3 text-white" href={href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => emit('click', position)}><span className="truncate">{ad.cta || 'Learn more'}</span></a>}
      {ad.skippable_after !== null && <button type="button" className="min-h-11 rounded-md bg-white px-3 font-semibold text-black disabled:bg-neutral-700 disabled:text-white" disabled={position < ad.skippable_after} onClick={() => finish('skip', position)}>{position >= ad.skippable_after ? 'Skip ad' : `Skip in ${Math.ceil(ad.skippable_after - position)}s`}</button>}
    </div>
  </div>;
}

function PaidPlayback({ viewerId, playbackSessionId, ...main }: MainProps & { viewerId: number; playbackSessionId: string }) {
  const key = `${viewerId}:${playbackSessionId}`;
  const state = playbackState(key, main.startSeconds ?? 0);
  const [pending, setPending] = useState(!state.attempted.has('preroll:once'));
  const [ad, setAd] = useState<Advertisement | null>(null);
  const [finished, setFinished] = useState(state.ended);
  const active = useRef(true);
  const busy = useRef(false);
  const latest = useRef(main);
  latest.current = main;
  const breakAd = async (placement: string, breakpoint = 'once', signal?: AbortSignal) => {
    const breakId = `${placement}:${breakpoint}`;
    if (!state.session || state.attempted.has(breakId) || busy.current) return false;
    state.attempted.add(breakId);
    busy.current = true;
    try {
      const selected = await decideAd(state.session, placement, breakpoint, viewerId, signal);
      if (!active.current || signal?.aborted) return false;
      if (selected?.kind === 'video') { setAd(selected); return true; }
    } catch { /* A timeout or unavailable ad always permits main content. */ }
    finally { busy.current = false; }
    return false;
  };
  useEffect(() => {
    const controller = new AbortController();
    active.current = true;
    void (async () => {
      try {
        state.session ??= await openAdSession({ context: 'playback', playback_session: playbackSessionId }, viewerId, controller.signal);
        if (!controller.signal.aborted) await breakAd('preroll', 'once', controller.signal);
      } catch { if (!controller.signal.aborted) state.attempted.add('preroll:once'); }
      finally { if (!controller.signal.aborted) setPending(false); }
    })();
    return () => { active.current = false; controller.abort(); };
    // This boundary is keyed to the server session, never the signed media URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (pending) return <div className="flex h-full items-center justify-center text-sm text-white/60" role="status">Preparing playback…</div>;
  if (ad && state.session) return <VideoAdvertisement key={ad.decision_id} ad={ad} session={state.session} viewerId={viewerId} done={() => {
    setAd(null);
    if (state.ended) { setFinished(true); latest.current.onEnded(); }
  }} />;
  if (finished) return null;
  return <TrackedVideo {...main} startSeconds={state.position}
    onProgress={(seconds, duration, force) => {
      state.position = seconds;
      main.onProgress?.(seconds, duration, force);
      if (ad || busy.current || !state.session || state.ended) return;
      const points = state.session.placements.find(p => p.code === 'midroll')?.breakpoints ?? [];
      // Resuming past a break consumes it without interrupting immediately.
      for (const point of points) {
        if (point <= (main.startSeconds ?? 0)) state.attempted.add(`midroll:${point}`);
        else if (seconds >= point && seconds < duration - 10 && !state.attempted.has(`midroll:${point}`)) {
          // Unmount flushes the last main frame before switching to the ad.
          void breakAd('midroll', String(point));
          break;
        }
      }
    }} onEnded={() => {
      state.ended = true;
      void breakAd('postroll').then(shown => { if (!shown && active.current) { setFinished(true); latest.current.onEnded(); } });
    }} />;
}

export function AdvertisingVideo({ advertisingEnabled, viewerId, playbackSessionId, ...main }: Props) {
  if (!advertisingEnabled || !viewerId || !playbackSessionId) return <TrackedVideo {...main} />;
  return <PaidPlayback key={`${viewerId}:${playbackSessionId}`} {...main} viewerId={viewerId} playbackSessionId={playbackSessionId} />;
}
