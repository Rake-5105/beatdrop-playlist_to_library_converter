import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PlaylistPreview } from "@/components/PlaylistPreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { History as HistoryIcon, Trash2, Music2, Youtube, Clock, ChevronDown } from "lucide-react";
import { getHistory, removeFromHistory, clearHistory, type HistoryEntry } from "@/lib/history";
import { toast } from "sonner";
import type { Track } from "@/lib/api";

const History = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<Track[] | null>(null);
  const [selectedPlaylistName, setSelectedPlaylistName] = useState<string>("");

  useEffect(() => {
    setEntries(getHistory());
  }, []);

  const handleRemove = (id: string) => {
    removeFromHistory(id);
    setEntries(getHistory());
    if (expandedId === id) setExpandedId(null);
    toast.success("Removed from history.");
  };

  const handleClearAll = () => {
    clearHistory();
    setEntries([]);
    setExpandedId(null);
    setSelectedTracks(null);
    toast.success("History cleared.");
  };

  const handleViewPlaylist = (entry: HistoryEntry) => {
    setSelectedTracks(entry.tracks);
    setSelectedPlaylistName(entry.playlistName);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        {/* Page title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <HistoryIcon className="w-7 h-7 text-foreground/60" />
              Conversion History
            </h1>
            <p className="text-muted-foreground mt-1">
              Your last {entries.length} conversions — stored locally in your browser.
            </p>
          </div>
          {entries.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="self-start sm:self-auto"
              onClick={handleClearAll}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {/* Empty state */}
        {entries.length === 0 && (
          <Card className="rounded-2xl glass border-foreground/[0.08] p-16 text-center text-muted-foreground">
            <HistoryIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No conversions yet.</p>
            <p className="text-sm mt-1">Convert a playlist on the home page to see it here.</p>
          </Card>
        )}

        {/* History list */}
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="rounded-2xl glass border-foreground/[0.08] overflow-hidden hover:glow-white-sm transition-all"
            >
              <div className="flex items-center gap-4 p-5">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    entry.source === "spotify"
                      ? "bg-foreground/[0.06]"
                      : "bg-foreground/[0.06]"
                  }`}
                >
                  {entry.source === "spotify" ? (
                    <Music2 className="w-5 h-5 text-foreground/50" />
                  ) : (
                    <Youtube className="w-5 h-5 text-foreground/50" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{entry.playlistName}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.url}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(entry.convertedAt)}
                    </span>
                    <span>{entry.trackCount} tracks</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewPlaylist(entry)}
                    className="hidden sm:flex text-xs"
                  >
                    View Playlist
                  </Button>
                  <button
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className={`h-7 w-7 rounded-lg border border-foreground/10 flex items-center justify-center hover:bg-foreground/[0.06] transition-all ${
                      expandedId === entry.id ? "rotate-180" : ""
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(entry.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded track list */}
              {expandedId === entry.id && (
                <div className="border-t border-foreground/[0.07] bg-foreground/[0.02] px-5 py-4 space-y-2 max-h-64 overflow-y-auto animate-fade-in">
                  {entry.tracks.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 bg-foreground/[0.06] flex items-center justify-center">
                        {t.thumbnail ? (
                          <img src={t.thumbnail} alt={t.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">{i + 1}</span>
                        )}
                      </div>
                      <span className="truncate font-medium">{t.title}</span>
                      <span className="text-muted-foreground truncate text-xs ml-auto">{t.artist}</span>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => handleViewPlaylist(entry)}
                  >
                    Open Full Playlist
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Playlist preview from history */}
        {selectedTracks && (
          <PlaylistPreview
            tracks={selectedTracks}
            playlistName={selectedPlaylistName}
            onDownload={(fmt) => console.log("Download", fmt)}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default History;
