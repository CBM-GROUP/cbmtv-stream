"use client";

import { useRef } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useSavedIds, savedIdsKey, savedItemsKey } from "@/hooks/useLibrary";
import { saveItem, removeSavedItem } from "@/services/library";
import { signInDestination } from "@/lib/auth-return";

export function MyListButton({ content }: { content: number }) {
  const { user, loading } = useAuth();
  const ids = useSavedIds(), client = useQueryClient(), lock = useRef(false);
  const saved = ids.data?.includes(content) ?? false;
  const mutation = useMutation({
    mutationFn: async (action: { owner: number; remove: boolean }) => { if (action.remove) await removeSavedItem(content); else await saveItem(content); },
    onSuccess: (_, action) => {
      client.setQueryData<number[]>(savedIdsKey(action.owner), (items = []) => action.remove ? items.filter((id) => id !== content) : [...new Set([...items, content])]);
      void client.invalidateQueries({ queryKey: savedItemsKey(action.owner) });
    },
  });
  const toggle = async () => {
    if (!user || lock.current || ids.isPending || ids.isError) return;
    lock.current = true;
    try { await mutation.mutateAsync({ owner: user.id, remove: saved }); } catch { /* Inline feedback retains the existing saved state. */ }
    finally { lock.current = false; }
  };
  if (!user && !loading) return <Link href={signInDestination(`/programs/${content}`)} className="detail-secondary-action"><Plus size={17} />My List</Link>;
  if (ids.isError) return <div><button className="detail-secondary-action" onClick={() => { void ids.refetch(); }}>Retry My List</button><p role="alert" className="mt-2 text-xs text-white/65">Your list couldn&apos;t be loaded.</p></div>;
  return <div><button type="button" className="detail-secondary-action w-full disabled:opacity-50" aria-pressed={saved} disabled={loading || ids.isPending || mutation.isPending} onClick={() => { void toggle(); }}>{saved ? <Check size={17} /> : <Plus size={17} />}{mutation.isPending ? "Updating list…" : loading || ids.isPending ? "Loading list…" : saved ? "In My List" : "My List"}</button>{mutation.isError && <p role="alert" className="mt-2 text-xs text-white/65">Your list wasn&apos;t updated. Try again.</p>}</div>;
}
