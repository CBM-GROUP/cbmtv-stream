export type PlaybackFlow = {
  phase: "trailer" | "main" | "ended";
  url: string | null;
  session: number;
  kind: "trailer" | "main";
  resumeAt: number;
};

export type PlaybackEvent =
  | { type: "open"; trailer: string | null; main: string | null; resumeAt?: number; skipTrailer?: boolean }
  | { type: "trailerFinished"; main: string | null; resumeAt?: number }
  | { type: "trailerFailed"; main: string | null; resumeAt?: number }
  | { type: "playMain"; url: string | null; resumeAt?: number; force?: boolean }
  | { type: "playTrailer"; url: string }
  | { type: "ended" }
  | { type: "playing" };

export function initialPlayback(trailer: string | null, main: string | null, options: { resumeAt?: number; skipTrailer?: boolean } = {}): PlaybackFlow {
  const resumeAt = Number.isFinite(options.resumeAt) ? Math.max(0, options.resumeAt ?? 0) : 0;
  const useTrailer = Boolean(trailer && (!main || (trailer !== main && !resumeAt && !options.skipTrailer)));
  const kind = useTrailer ? "trailer" : "main";
  return { phase: kind, kind, url: useTrailer ? trailer : main, session: 0, resumeAt: useTrailer ? 0 : resumeAt };
}

export function playbackTransition(state: PlaybackFlow, event: PlaybackEvent): PlaybackFlow {
  switch (event.type) {
    case "open":
      return { ...initialPlayback(event.trailer, event.main, event), session: state.session + 1 };
    case "trailerFinished":
    case "trailerFailed":
      // A late trailer event after Skip must not restart the movie.
      return state.phase === "trailer"
        ? event.main ? { phase: "main", kind: "main", url: event.main, session: state.session + 1, resumeAt: event.resumeAt ?? 0 } : { ...state, phase: "ended" }
        : state;
    case "playMain":
      return !event.force && state.phase === "main" && state.url === event.url ? state : { phase: "main", kind: "main", url: event.url, session: state.session + 1, resumeAt: event.resumeAt ?? 0 };
    case "playTrailer":
      return state.phase === "trailer" && state.url === event.url ? state : { phase: "trailer", kind: "trailer", url: event.url, session: state.session + 1, resumeAt: 0 };
    case "ended":
      return state.phase === "main" ? { ...state, phase: "ended" } : state;
    case "playing":
      return state.phase === "ended" ? { ...state, phase: state.kind } : state;
  }
}
