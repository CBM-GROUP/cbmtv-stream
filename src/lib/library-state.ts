import type { SavedItem, WatchProgress } from "@/types";

/** The public website never renders library rows for unpublished content. */
export const publicSaved = (items: SavedItem[]) =>
  items.filter((item) => item.content?.status === "approved");

export const publicProgress = (items: WatchProgress[]) =>
  items.filter((item) => item.content?.status === "approved" && !item.completed);

export const withSaved = (items: SavedItem[], item: SavedItem) =>
  [item, ...items.filter((row) => row.content.id !== item.content.id)];

export const withoutSaved = (items: SavedItem[], contentId: number) =>
  items.filter((item) => item.content.id !== contentId);

export const withProgress = (items: WatchProgress[], row: WatchProgress) => {
  const rest = items.filter((item) => item.content.id !== row.content.id);
  return row.completed ? rest : [row, ...rest];
};
