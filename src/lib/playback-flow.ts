export type PlaybackFlow = {
  phase: "trailer" | "main" | "ended";
  url: string | null;
  session: number;
};

export type PlaybackEvent =
  | { type: "open"; trailer: string | null; main: string | null }
  | { type: "trailerFinished"; main: string | null }
  | { type: "playMain"; url: string | null }
  | { type: "ended" }
  | { type: "playing" };

export function initialPlayback(trailer: string | null, main: string | null): PlaybackFlow {
  return { phase: trailer ? "trailer" : "main", url: trailer || main, session: 0 };
}

export function playbackTransition(state: PlaybackFlow, event: PlaybackEvent): PlaybackFlow {
  switch (event.type) {
    case "open":
      return { ...initialPlayback(event.trailer, event.main), session: state.session + 1 };
    case "trailerFinished":
      // A late trailer event after Skip must not restart the movie.
      return state.phase === "trailer"
        ? { phase: "main", url: event.main, session: state.session + 1 }
        : state;
    case "playMain":
      return { phase: "main", url: event.url, session: state.session + 1 };
    case "ended":
      return state.phase === "main" ? { ...state, phase: "ended" } : state;
    case "playing":
      return state.phase === "ended" ? { ...state, phase: "main" } : state;
  }
}
