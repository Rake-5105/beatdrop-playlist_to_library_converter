import type { Track } from "./api";

export interface HistoryEntry {
  id: string;
  url: string;
  playlistName: string;
  source: "spotify" | "youtube";
  trackCount: number;
  convertedAt: string; // ISO date string
  tracks: Track[];
}

const HISTORY_KEY = "playlist_portal_history";

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addToHistory(entry: Omit<HistoryEntry, "id" | "convertedAt">): HistoryEntry {
  const newEntry: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    convertedAt: new Date().toISOString(),
  };
  const existing = getHistory().filter((e) => e.url !== entry.url);
  const updated = [newEntry, ...existing].slice(0, 50); // keep last 50
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return newEntry;
}

export function removeFromHistory(id: string): void {
  const updated = getHistory().filter((e) => e.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
