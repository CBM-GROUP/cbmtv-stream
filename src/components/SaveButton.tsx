"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLibrary } from "@/context/LibraryContext";

export function SaveButton({ contentId, title, className = "" }: { contentId: number; title: string; className?: string }) {
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
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/30 text-white shadow-lg transition-colors ${isSaved ? "bg-teal-500 text-black" : "bg-black/70 hover:bg-black"} disabled:opacity-50`}
      >
        <Heart size={19} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      {message && <span role="status" className="absolute right-0 top-11 z-20 w-44 rounded-md bg-black p-2 text-xs text-white shadow-lg">{message}</span>}
    </div>
  );
}
