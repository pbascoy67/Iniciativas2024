export interface TimelineItem {
  kind: "email" | "meeting" | "call" | "note" | "task" | "stage";
  at: Date;
  title: string;
  body?: string;
  author?: string | null;
  id: string;
}

/** Newest first; stable for equal timestamps. */
export function sortTimeline(items: TimelineItem[]): TimelineItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => b.item.at.getTime() - a.item.at.getTime() || a.i - b.i)
    .map((x) => x.item);
}
