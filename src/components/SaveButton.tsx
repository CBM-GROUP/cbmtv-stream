"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLibrary } from "@/context/LibraryContext";

export function SaveButton({ contentId, title, className = "", showLabel = false }: { contentId: number; title: string; className?: string; showLabel?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const { saved, savedIds, pending, toggleSaved } = useLibrary();
  const [message, setMessage] = useState("");
  const isSaved = savedIds.has(contentId);
  const busy = pending.has(contentId);

  return (
    <div className={className}>
      <button
        type="button"
        aria-label={`${isSaved ? "Remove" : "Save"} ${title} ${isSaved ? "from" : "to"} saved`}
        aria-pressed={isSaved}
        title={isSaved ? "Remove from saved" : "Save title"}
        disabled={authLoading || (Boolean(user) && (!saved.loaded || saved.loading || busy))}
        onClick={async () => {
          setMessage("");
          const result = await toggleSaved(contentId);
          if (result === "auth-required") setMessage("Sign in to save titles.");
          if (result === "failed") setMessage("Could not update saved titles. Try again.");
        }}
        className={`flex h-10 items-center justify-center gap-2 rounded-full border border-white/30 text-white shadow-lg transition-colors ${showLabel ? "px-3" : "w-10"} ${isSaved ? "bg-teal-500 text-black" : "bg-black/70 hover:bg-black"} disabled:opacity-50`}
      >
        <Heart size={19} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
        {showLabel && <span className="text-sm font-medium">{isSaved ? "Saved" : "Save"}</span>}
      </button>
      {message && <span role="status" className={`absolute top-11 z-20 w-44 rounded-md bg-black p-2 text-xs text-white shadow-lg ${showLabel ? "left-0" : "right-0"}`}>{message}</span>}
    </div>
  );
}
