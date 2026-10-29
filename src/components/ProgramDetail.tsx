"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Play, Share2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProgressRecorder, useWatchProgress } from "@/hooks/useLibrary";
import { initialPlayback, playbackTransition, type PlaybackFlow } from "@/lib/playback-flow";
import { contentCategory, episodePart, formatDuration, matchingProgress, mediaSource, miniPart, orderedEpisodes, orderedMiniParts, orderedSeasons, resumePosition, type Part, type PartSelector } from "@/lib/viewing";
import { playbackDestination } from "@/lib/auth-return";
import { getEpisode, getMiniSeriesParts, getSeasonEpisodes, getSeriesSeasons } from "@/services/series";
import { listContentPreview } from "@/services/content";
import { getChannelById } from "@/services/channels";
import type { Program } from "@/types";
import { ContentRail } from "./ContentRail";
import { MyListButton } from "./MyListButton";
import { PlayerOptions } from "./PlayerOptions";
import { SafeImage } from "./SafeImage";
import SeasonsAccordion from "./SeasonsAccordion";
import { TrackedVideo, type MediaControls } from "./TrackedVideo";
import { TrackedYouTube } from "./TrackedYouTube";

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type Props = { program: Program; requested?: PartSelector & { invalid?: boolean } };
const PLAYER_MODE_KEY = "cbmtv:player-mode-v2";
const episodeQuery = (id: number) => ({ queryKey: ["viewing-episodes", id], queryFn: ({ signal }: { signal: AbortSignal }) => getSeasonEpisodes(id, signal).then(orderedEpisodes), staleTime: 60000, retry: 1 });

export default function ProgramDetail({ program, requested }: Props) {
  const { user, loading: authLoading } = useAuth(), history = useWatchProgress(), client = useQueryClient();
  const [playback, setPlayback] = useState<PlaybackFlow | null>(null);
  const [currentPart, setCurrentPart] = useState<Part | null>(null), [selectedSeason, setSelectedSeason] = useState(0);
  const [nextPart, setNextPart] = useState<Part | null>(null), [secondsLeft, setSecondsLeft] = useState(30);
  const [setupError, setSetupError] = useState(""), [setupAttempt, setSetupAttempt] = useState(0), [withoutHistory, setWithoutHistory] = useState(false);
  const [notice, setNotice] = useState(""), [expanded, setExpanded] = useState(false);
  const [playerMode, setPlayerMode] = useState<"standard" | "theater">("standard"), [fullscreen, setFullscreen] = useState(false), [playing, setPlaying] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null), controls = useRef<MediaControls | null>(null), initialized = useRef(false), nextRequest = useRef(0), mainPosition = useRef(0), initializedOwner = useRef<number | null>(null);
  const eligibleSeasons = !["movie", "music", "miniseries"].includes(program.content_type);
  const seasons = useQuery({ queryKey: ["viewing-seasons", program.id], queryFn: ({ signal }) => getSeriesSeasons(program.id, signal).then((items) => orderedSeasons(items.filter((s) => s.content === program.id))), enabled: eligibleSeasons, staleTime: 60000, retry: 1 });
  const parts = useQuery({ queryKey: ["viewing-parts", program.id], queryFn: ({ signal }) => getMiniSeriesParts(program.id, signal).then((items) => orderedMiniParts(items.filter((p) => p.content === program.id))), enabled: program.content_type === "miniseries", staleTime: 60000, retry: 1 });
  const episodes = useQuery({ ...episodeQuery(selectedSeason), enabled: selectedSeason > 0 });
  const related = useQuery({ queryKey: ["viewing-related", program.channel], queryFn: ({ signal }) => listContentPreview(undefined, signal, false, program.channel), enabled: Boolean(program.channel), staleTime: 60000, retry: 1 });
  const channel = useQuery({ queryKey: ["channel", String(program.channel)], queryFn: () => getChannelById(program.channel).then((r) => r.data), enabled: Boolean(program.channel), staleTime: 60000, retry: 1 });
  const recorder = useProgressRecorder(program.id, currentPart, Boolean(user && playback?.kind === "main" && !withoutHistory && initialized.current && user.id === initializedOwner.current));
  const trailer = mediaSource(program.trailer_link)?.url ?? null;
  const episodic = Boolean(seasons.data?.length || parts.data?.length);
  const main = currentPart?.url ?? (episodic ? null : mediaSource(program.streaming_link)?.url ?? null);
  const source = mediaSource(playback?.url);
  const historyFailed = Boolean(user && history.isError && !withoutHistory && !initialized.current);

  // Choose a source once, after authentication and saved progress are known.
  // Later cache updates must never seek or restart an active player.
  useEffect(() => {
    if (initialized.current || authLoading || (user && !withoutHistory && (history.isPending || history.isFetching || history.isError))) return;
    if ((eligibleSeasons && seasons.isPending) || (program.content_type === "miniseries" && parts.isPending)) return;
    let cancelled = false;
    const prepare = async () => {
      setSetupError("");
      try {
        if (requested?.invalid) throw new Error("This episode link is invalid. Choose an available episode below.");
        if ((eligibleSeasons && seasons.isError) || (program.content_type === "miniseries" && parts.isError)) throw new Error("The available seasons or parts couldn't be loaded. Please try again.");
        const progress = withoutHistory ? undefined : history.data?.find((p) => p.content.id === program.id);
        const explicit = Boolean(requested?.episode || requested?.miniseries);
        const selector = explicit ? requested : resumePosition(progress) ? progress : undefined;
        let target: Part | null = null;
        if (selector?.episode) {
          const episode = await client.fetchQuery({ queryKey: ["viewing-episode", selector.episode], queryFn: ({ signal }) => getEpisode(selector.episode as number, signal), staleTime: 60000, retry: 1 });
          if (!seasons.data?.some((s) => s.id === episode.season)) throw new Error("This episode isn't available for this title. Choose an episode below.");
          const available = await client.fetchQuery(episodeQuery(episode.season));
          target = available.some((e) => e.id === episode.id) ? episodePart(episode) : null;
          if (!target) throw new Error("This episode is currently unavailable. Choose another episode below.");
        } else if (selector?.miniseries) {
          const part = parts.data?.find((p) => p.id === selector.miniseries);
          target = part ? miniPart(part) : null;
          if (!target) throw new Error("This part is currently unavailable. Choose another part below.");
        } else if (seasons.data?.length) {
          for (const season of seasons.data) {
            const available = await client.fetchQuery(episodeQuery(season.id));
            target = available.map(episodePart).find((p) => p !== null) ?? null;
            if (target) break;
          }
        } else if (parts.data?.length) target = parts.data.map(miniPart).find((p) => p !== null) ?? null;
        if (cancelled || initialized.current) return;
        initialized.current = true; initializedOwner.current = user?.id ?? null;
        setCurrentPart(target);
        if (target?.season) setSelectedSeason(target.season);
        else if (seasons.data?.[0]) setSelectedSeason(seasons.data[0].id);
        const resumeAt = matchingProgress(progress, target) ? resumePosition(progress) : 0; mainPosition.current = resumeAt;
        const targetUrl = target?.url ?? (seasons.data?.length || parts.data?.length ? null : mediaSource(program.streaming_link)?.url ?? null);
        setPlayback(initialPlayback(trailer, targetUrl, { resumeAt, skipTrailer: explicit || resumeAt > 0 }));
      } catch (error) { if (!cancelled && !initialized.current) { setSetupError(error instanceof Error ? error.message : "Playback couldn't be prepared. Please try again."); if (seasons.data?.[0]) setSelectedSeason((s) => s || seasons.data[0].id); } }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [authLoading, user, history.data, history.isPending, history.isFetching, history.isError, withoutHistory, eligibleSeasons, seasons.data, seasons.isPending, seasons.isError, parts.data, parts.isPending, parts.isError, program.id, program.content_type, program.streaming_link, requested, trailer, client, setupAttempt]);

  useEffect(() => {
    try { const stored = localStorage.getItem(PLAYER_MODE_KEY); if (stored === "theater" || stored === "standard") setPlayerMode(stored); } catch { /* Optional preference. */ }
    const change = () => { const doc = document as FullscreenDocument; setFullscreen((doc.fullscreenElement ?? doc.webkitFullscreenElement) === playerRef.current); };
    document.addEventListener("fullscreenchange", change); document.addEventListener("webkitfullscreenchange", change);
    const cancelPendingNext = () => { nextRequest.current++; };
    return () => { document.removeEventListener("fullscreenchange", change); document.removeEventListener("webkitfullscreenchange", change); cancelPendingNext(); };
  }, []);
  const toggleMode = () => setPlayerMode((mode) => { const next = mode === "standard" ? "theater" : "standard"; try { localStorage.setItem(PLAYER_MODE_KEY, next); } catch { /* Optional. */ } return next; });
  const toggleFullscreen = () => {
    const doc = document as FullscreenDocument, band = playerRef.current as FullscreenElement | null;
    const request = doc.fullscreenElement || doc.webkitFullscreenElement ? doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc) : band?.requestFullscreen?.bind(band) ?? band?.webkitRequestFullscreen?.bind(band);
    void Promise.resolve(request?.()).catch(() => setNotice("Fullscreen isn't available here. You can also use the video's fullscreen control."));
  };
  const receiveControls = useCallback((value: MediaControls | null) => { controls.current = value; }, []);
  const playPart = useCallback((part: Part) => {
    if (authLoading || (!initialized.current && user && !withoutHistory && (history.isPending || history.isFetching || history.isError))) { setNotice("Load your saved history, or choose Play without saving, before selecting an episode."); return; }
    if (currentPart?.key === part.key && playback?.kind === "main" && playback.phase !== "ended") { nextRequest.current++; setNextPart(null); controls.current?.play(); return; }
    nextRequest.current++; controls.current?.pause(); initialized.current = true; initializedOwner.current = user?.id ?? null;
    setSetupError(""); mainPosition.current = 0; setCurrentPart(part); if (part.season) setSelectedSeason(part.season);
    setPlayback((state) => state ? playbackTransition(state, { type: "playMain", url: part.url, force: true }) : initialPlayback(null, part.url));
    setNextPart(null); setSecondsLeft(30);
    window.history.replaceState(null, "", playbackDestination(program.id, part));
    playerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [program.id, authLoading, user, withoutHistory, history.isPending, history.isFetching, history.isError, currentPart, playback]);
  const startMain = () => { setNextPart(null); setPlayback((state) => state ? playbackTransition(state, { type: "trailerFinished", main, resumeAt: mainPosition.current }) : state); };
  const onEnded = async () => {
    if (!playback) return;
    if (playback.kind === "trailer") { startMain(); return; }
    setPlayback((state) => state ? playbackTransition(state, { type: "ended" }) : state);
    if (!currentPart) return;
    const request = ++nextRequest.current;
    try {
      let upcoming: Part | undefined;
      if (currentPart.miniseries) { const list = (parts.data ?? []).map(miniPart).filter((p): p is Part => p !== null); const index = list.findIndex((p) => p.key === currentPart.key); if (index >= 0) upcoming = list[index + 1]; }
      else if (currentPart.season) {
        const list = (await client.fetchQuery(episodeQuery(currentPart.season))).map(episodePart).filter((p): p is Part => p !== null);
        const index = list.findIndex((p) => p.key === currentPart.key); if (index >= 0) upcoming = list[index + 1];
        if (!upcoming) { const seasonIndex = seasons.data?.findIndex((s) => s.id === currentPart.season) ?? -1; if (seasonIndex >= 0) for (const season of (seasons.data ?? []).slice(seasonIndex + 1)) { upcoming = (await client.fetchQuery(episodeQuery(season.id))).map(episodePart).find((p) => p !== null) ?? undefined; if (upcoming) break; } }
      }
      if (request === nextRequest.current && upcoming) { setSecondsLeft(30); setNextPart(upcoming); }
    } catch { if (request === nextRequest.current) setNotice("The next episode couldn't be loaded. Select an episode below to continue."); }
  };
  useEffect(() => { if (!nextPart) return; const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(timer); }, [nextPart]);
  useEffect(() => { if (nextPart && secondsLeft === 0) playPart(nextPart); }, [nextPart, secondsLeft, playPart]);
  const share = async () => { try { if (navigator.share) await navigator.share({ title: program.title, url: location.href }); else { await navigator.clipboard.writeText(location.href); setNotice("Link copied."); } } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("The link couldn't be shared. You can copy it from the address bar."); } };
  const retrySetup = () => { if (eligibleSeasons) void seasons.refetch(); if (program.content_type === "miniseries") void parts.refetch(); setSetupAttempt((n) => n + 1); };
  const relatedItems = (related.data ?? []).filter((item) => item.id !== program.id && item.channel === program.channel && item.status === "approved");

  return <>
    <div className="watch-layout" data-player-mode={playerMode}>
      <div className="min-w-0">
        <div ref={playerRef} className="player-band group relative w-full min-w-0 bg-black"><div className="player-frame">
          {source?.kind === "direct" && playback && <TrackedVideo src={source.url} session={playback.session} resumeAt={playback.resumeAt} poster={program.thumbnail} title={currentPart?.title || program.title} onEnded={() => { void onEnded(); }} onFailure={playback.kind === "trailer" && main ? () => { setNotice("The trailer couldn't be loaded. Starting the main video."); startMain(); } : undefined} onPlaybackChange={setPlaying} onPlay={() => setPlayback((state) => state ? playbackTransition(state, { type: "playing" }) : state)} onSample={(position, duration, urgent, ended) => { if (playback.kind === "main") { mainPosition.current = ended ? 0 : position; recorder.sample(position, duration, urgent, ended); } }} onControls={receiveControls} />}
          {source?.kind === "youtube" && source.videoId && playback && <TrackedYouTube videoId={source.videoId} session={playback.session} resumeAt={playback.resumeAt} onEnded={() => { void onEnded(); }} onFailure={playback.kind === "trailer" && main ? startMain : undefined} onPlaybackChange={setPlaying} onSample={(position, duration, urgent, ended) => { if (playback.kind === "main") { mainPosition.current = ended ? 0 : position; recorder.sample(position, duration, urgent, ended); } }} onControls={receiveControls} />}
          {!source && <div className="absolute inset-0 flex items-center justify-center p-5 text-center text-sm" role="status">{program.thumbnail && <SafeImage src={program.thumbnail} alt="" fill className="object-contain opacity-20" sizes="(min-width: 1200px) 64vw, 92vw" />}<div className="relative max-w-sm rounded-lg bg-black/75 p-4">{historyFailed ? <><p>Your saved position couldn&apos;t be loaded.</p><div className="mt-3 flex flex-wrap justify-center gap-3"><button className="detail-secondary-action" onClick={() => { void history.refetch(); }}>Retry history</button><button className="detail-secondary-action" onClick={() => setWithoutHistory(true)}>Play without saving</button></div></> : setupError ? <><p>{setupError}</p><button className="detail-secondary-action mt-3" onClick={retrySetup}>Try again</button></> : playback ? "Video is currently unavailable." : "Preparing playback..."}</div></div>}
          {nextPart && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/85 p-3"><div role="dialog" aria-label="Next episode" className="max-h-full max-w-sm overflow-y-auto rounded-lg bg-neutral-950 p-4 text-center"><p className="text-xs text-teal-300">UP NEXT</p><h2 className="mt-2 font-semibold">{nextPart.title}</h2><p className="mt-2 text-sm text-white/65">Starting in {secondsLeft} seconds</p><div className="mt-4 flex justify-center gap-3"><button className="primary-action" onClick={() => playPart(nextPart)}>Watch next</button><button className="detail-secondary-action" onClick={() => { nextRequest.current++; setNextPart(null); }}>Cancel</button></div></div></div>}
          <PlayerOptions playerRef={playerRef} playing={playing && playback?.phase !== "ended" && !nextPart} cinema={playerMode === "theater"} fullscreen={fullscreen} onCinema={toggleMode} onFullscreen={toggleFullscreen} onSkipTrailer={playback?.phase === "trailer" && main ? startMain : undefined} />
        </div></div>
        <div className="player-status-slot" data-reserved={Boolean(trailer || eligibleSeasons || program.content_type === "miniseries")} >
        {playback?.kind === "trailer" && <div className="playback-status"><span>Trailer</span>{main && <button onClick={startMain} className="text-teal-300">Skip trailer</button>}</div>}
        {currentPart && playback?.kind === "main" && <p className="playback-status" role="status">{currentPart.season ? `Season ${seasons.data?.find((s) => s.id === currentPart.season)?.season_number ?? ""} · Episode ${currentPart.number}` : `Part ${currentPart.number}`} — {currentPart.title}</p>}
        {recorder.failed && <p className="playback-status" role="alert">Your position hasn&apos;t been saved. <button className="text-teal-300" onClick={recorder.retry}>Retry saving</button></p>}
        {notice && <p className="playback-status" role="status">{notice}<button className="text-teal-300" aria-label="Dismiss message" onClick={() => setNotice("")}>Dismiss</button></p>}
        </div>
      </div>
      <aside className="watch-sidebar" aria-label="Content information">
        <div className="flex items-start gap-4"><SafeImage src={program.thumbnail} alt={`${program.title} poster`} width={160} height={240} className="detail-poster" /><div className="min-w-0"><p className="text-xs font-medium text-teal-300">{contentCategory(program.content_type)}</p><h1 className="mt-2 text-2xl leading-tight font-bold text-white">{program.title}</h1><p className="mt-3 text-sm leading-6 text-white/65">{[program.genre?.trim(), formatDuration(program.duration), program.country?.trim()].filter(Boolean).join(" · ")}</p></div></div>
        <div className="detail-actions"><button className="primary-action disabled:opacity-50" disabled={!main || !playback} onClick={() => { nextRequest.current++; setNextPart(null); if (playback?.kind === "main" && playback.phase !== "ended") controls.current?.play(); else setPlayback((state) => state ? playbackTransition(state, { type: "playMain", url: main, resumeAt: playback?.phase === "ended" ? 0 : mainPosition.current }) : state); }}><Play size={17} />{playback?.kind === "main" && playing ? "Playing" : playback?.phase === "ended" ? "Watch again" : playback?.kind === "main" && playback.resumeAt > 0 ? "Continue watching" : "Watch now"}</button>{trailer && <button className="detail-secondary-action" disabled={!playback || playback.phase === "trailer"} onClick={() => { nextRequest.current++; controls.current?.pause(); setNextPart(null); setPlayback((state) => state ? playbackTransition(state, { type: "playTrailer", url: trailer }) : state); }}>Watch trailer</button>}<MyListButton content={program.id} /><button className="detail-secondary-action" onClick={() => { void share(); }}><Share2 size={17} />Share</button></div>
        {program.description?.trim() && <div className="mt-5"><h2 className="text-sm font-semibold text-white/90">Synopsis</h2><p className={`mt-2 text-sm leading-6 text-white/65 ${expanded ? "" : "line-clamp-5"}`}>{program.description}</p>{program.description.length > 240 && <button className="mt-1 min-h-11 text-sm text-teal-300" onClick={() => setExpanded(!expanded)}>{expanded ? "Read less" : "Read more"}</button>}</div>}
        <dl className="detail-credits">{[["Director", program.director], ["Writer", program.writer]].filter(([, value]) => value?.trim()).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {program.channel && <Link className="mt-4 inline-flex min-h-11 items-center text-sm text-teal-300" href={`/channels/${program.channel}`}>{channel.data?.name || "View channel"}</Link>}
      </aside>
    </div>
    {(Boolean(seasons.data?.length) || seasons.isError || Boolean(parts.data?.length) || parts.isError) && <section className="detail-episodes" aria-label="Episodes and parts"><h2 className="section-title mb-3">{program.content_type === "miniseries" ? "Parts" : "Seasons & episodes"}</h2>
      {eligibleSeasons && (seasons.isError ? <button className="detail-secondary-action" onClick={retrySetup}>Retry seasons</button> : <SeasonsAccordion seasons={seasons.data ?? []} selectedSeason={selectedSeason || seasons.data?.[0]?.id || 0} episodesBySeason={{ [selectedSeason]: episodes.data ?? [] }} currentEpisode={currentPart?.episode} playing={playing && playback?.kind === "main"} loading={episodes.isPending} error={episodes.isError} onSeasonChange={setSelectedSeason} onEpisodeSelect={(episode) => { const part = episodePart(episode); if (part) playPart(part); }} onRetry={() => { void episodes.refetch(); }} />)}
      {parts.isError && program.content_type === "miniseries" && <button className="detail-secondary-action" onClick={() => { void parts.refetch(); }}>Retry parts</button>}
      {program.content_type === "miniseries" && <div className="episode-grid">{parts.data?.map((item) => { const part = miniPart(item), selected = currentPart?.miniseries === item.id; return <button className="episode-card p-4" key={item.id} disabled={!part} aria-pressed={selected} data-selected={selected} onClick={() => { if (part) playPart(part); }}><p className="text-xs text-teal-300">Part {item.miniseries_no}{selected ? playing && playback?.kind === "main" ? " · Now playing" : " · Selected" : ""}</p><h3 className="mt-2 text-sm font-semibold">{item.title}</h3>{item.duration && <p className="mt-2 text-xs text-white/60">{formatDuration(item.duration)}</p>}{!part && <p className="mt-2 text-xs">Not available</p>}</button>; })}</div>}
    </section>}
    <div className="detail-related"><ContentRail title="More from this channel" items={relatedItems} loading={related.isPending} error={related.isError} onRetry={() => { void related.refetch(); }} /></div>
  </>;
}
