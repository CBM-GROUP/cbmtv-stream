"use client";

import * as Popover from "@radix-ui/react-popover";
import { Maximize, Minimize, MoreVertical, RectangleHorizontal } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

export function PlayerOptions({ playerRef, playing, cinema, fullscreen, onCinema, onFullscreen, onSkipTrailer }: {
  playerRef: RefObject<HTMLDivElement | null>;
  playing: boolean;
  cinema: boolean;
  fullscreen: boolean;
  onCinema: () => void;
  onFullscreen: () => void;
  onSkipTrailer?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    let timer: ReturnType<typeof setTimeout>;
    const reveal = () => {
      setVisible(true);
      clearTimeout(timer);
      if (playing && !open) timer = setTimeout(() => setVisible(false), 2500);
    };
    const blur = () => {
      // Iframe interaction does not bubble. Reveal when focus enters its player.
      if (player.contains(document.activeElement)) reveal();
    };
    reveal();
    player.addEventListener("pointerenter", reveal);
    player.addEventListener("pointermove", reveal);
    player.addEventListener("pointerdown", reveal);
    player.addEventListener("keydown", reveal);
    player.addEventListener("focusin", reveal);
    window.addEventListener("blur", blur);
    return () => {
      clearTimeout(timer);
      player.removeEventListener("pointerenter", reveal);
      player.removeEventListener("pointermove", reveal);
      player.removeEventListener("pointerdown", reveal);
      player.removeEventListener("keydown", reveal);
      player.removeEventListener("focusin", reveal);
      window.removeEventListener("blur", blur);
    };
  }, [playerRef, playing, open]);

  return <div className="player-options" data-visible={visible || open || !playing}>
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="player-option-button" aria-label="Player options" title="Player options"><MoreVertical size={20} aria-hidden="true" /></Popover.Trigger>
      {/* Stay inside the fullscreen element instead of portalling to body. */}
      <Popover.Content align="end" sideOffset={6} aria-label="Player options" className="z-30 w-48 rounded-md border border-white/15 bg-neutral-950 p-1 text-white shadow-xl">
        {onSkipTrailer && <button type="button" onClick={() => { onSkipTrailer(); setOpen(false); }} className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm hover:bg-white/10">Skip trailer</button>}
        <button type="button" aria-pressed={cinema} onClick={() => { onCinema(); setOpen(false); }} className="flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-white/10">
          <RectangleHorizontal size={18} aria-hidden="true" />{cinema ? "Exit cinema mode" : "Cinema mode"}
        </button>
      </Popover.Content>
    </Popover.Root>
    <button type="button" onClick={onFullscreen} className="player-option-button" aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
      {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
    </button>
  </div>;
}
