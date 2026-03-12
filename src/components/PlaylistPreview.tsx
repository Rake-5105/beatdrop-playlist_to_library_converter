import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Music, Trash2, ExternalLink, Search, GripVertical, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { downloadTrack, downloadAllTracks, type Track } from "@/lib/api";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PlaylistPreviewProps {
  tracks: Track[];
  playlistName?: string;
  onDownload: (format: string) => void;
  onTracksChange?: (tracks: Track[]) => void;
}

const formats = [
  { value: "mp3", label: "MP3 — Recommended ★" },
  { value: "flac", label: "FLAC (Lossless)" },
  { value: "wav", label: "WAV (Lossless)" },
  { value: "m4a", label: "M4A (AAC)" },
];

const qualities = [
  { value: "best",  label: "Best (VBR) ★" },
  { value: "320k",  label: "320 kbps" },
  { value: "192k",  label: "192 kbps" },
  { value: "128k",  label: "128 kbps" },
];

const LOSSLESS = new Set(["flac", "wav"]);

// ── Sortable track row ─────────────────────────────────────────
interface SortableTrackProps {
  track: Track;
  index: number;
  selectedFormat: string;
  onRemove: (id: string) => void;
  onDownloadSingle: (track: Track, format: string) => void;
}

const SortableTrack = ({ track, index, selectedFormat, onRemove, onDownloadSingle }: SortableTrackProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors group ${
        isDragging ? "bg-foreground/[0.07] shadow-lg z-10" : "hover:bg-foreground/[0.04]"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Thumbnail / number */}
      <div className="flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-foreground/[0.06] border border-foreground/[0.08] flex items-center justify-center">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-foreground/40">{index + 1}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold truncate text-sm">{track.title}</h4>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
      </div>

      {/* Duration */}
      {track.duration && (
        <span className="hidden sm:block text-xs text-muted-foreground flex-shrink-0">
          {track.duration}
        </span>
      )}

      {/* Source badge */}
      {track.source && (
        <Badge variant="secondary" className="hidden md:flex text-xs capitalize flex-shrink-0">
          {track.source}
        </Badge>
      )}

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {track.externalUrl && (
          <a
            href={track.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in browser"
          >
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-foreground/50 hover:text-foreground"
          title={`Download as ${selectedFormat.toUpperCase()}`}
          onClick={() => onDownloadSingle(track, selectedFormat)}
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onRemove(track.id)}
          title="Remove track"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────
export const PlaylistPreview = ({
  tracks: initialTracks,
  playlistName,
  onDownload,
  onTracksChange,
}: PlaylistPreviewProps) => {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [selectedFormat, setSelectedFormat] = useState("mp3");
  const [selectedQuality, setSelectedQuality] = useState("best");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Search filter
  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return tracks;
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );
  }, [tracks, searchQuery]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tracks, oldIndex, newIndex);
    setTracks(reordered);
    onTracksChange?.(reordered);
  };

  const handleRemove = (id: string) => {
    const updated = tracks.filter((t) => t.id !== id);
    setTracks(updated);
    onTracksChange?.(updated);
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    setDownloadProgress(0);
    setStatusMessage("");
    const effectiveQuality = LOSSLESS.has(selectedFormat) ? "best" : selectedQuality;
    try {
      await downloadAllTracks(
        tracks,
        selectedFormat,
        (done, total) => {
          setDownloadProgress(Math.round((done / total) * 100));
        },
        (msg, track) => {
          toast.warning(`Skipped "${track.title}": ${msg}`);
        },
        playlistName || "playlist",
        (msg) => setStatusMessage(msg),
        effectiveQuality
      );
      toast.success(`ZIP ready! ${tracks.length} tracks downloaded as ${selectedFormat.toUpperCase()} 🎉`);
      onDownload(selectedFormat);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      toast.error(msg);
    } finally {
      setIsDownloadingAll(false);
      setStatusMessage("");
    }
  };

  const handleDownloadSingle = async (track: Track, format: string) => {
    const effectiveQuality = LOSSLESS.has(format) ? "best" : selectedQuality;
    setDownloadingId(track.id);
    toast.info(`Downloading "${track.title}"...`);
    try {
      await downloadTrack(track, format, (msg) => toast.error(msg), effectiveQuality);
      toast.success(`Downloaded "${track.title}" as ${format.toUpperCase()}!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      toast.error(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className="w-full animate-slide-up">
      <div className="max-w-5xl mx-auto">
        <Card className="rounded-2xl glass glow-white-sm overflow-hidden border-foreground/[0.09]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-foreground/[0.07] bg-foreground/[0.03]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Music className="w-5 h-5 text-foreground/60 flex-shrink-0" />
                <span className="truncate">{playlistName ?? "Playlist Preview"}</span>
              </h3>
              <span className="sm:ml-auto text-sm font-normal text-muted-foreground flex-shrink-0">
                {filteredTracks.length} / {tracks.length} tracks
              </span>
            </div>

            {/* Search */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or artist..."
                className="pl-9 h-9 rounded-lg text-sm border-foreground/10 bg-foreground/[0.04] placeholder:text-muted-foreground/40 focus-visible:ring-foreground/15"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Track list with DnD */}
          <div className="p-4 space-y-1 max-h-[480px] overflow-y-auto">
            {filteredTracks.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No tracks match your search.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredTracks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredTracks.map((track, index) => (
                    <SortableTrack
                      key={track.id}
                      track={track}
                      index={index}
                      selectedFormat={selectedFormat}
                      onRemove={handleRemove}
                      onDownloadSingle={handleDownloadSingle}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Download panel */}
          <div className="border-t border-foreground/[0.07] bg-foreground/[0.02] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              {/* Format */}
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Format</label>
                <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                  <SelectTrigger className="h-11 rounded-xl border-foreground/10 bg-foreground/[0.05]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality — disabled for lossless */}
              <div className="flex-1">
                <label className={`text-sm font-medium mb-2 block ${LOSSLESS.has(selectedFormat) ? "opacity-40" : ""}`}>
                  Quality{LOSSLESS.has(selectedFormat) && <span className="ml-1.5 text-xs font-normal text-foreground/40">(lossless)</span>}
                </label>
                <Select
                  value={selectedQuality}
                  onValueChange={setSelectedQuality}
                  disabled={LOSSLESS.has(selectedFormat)}
                >
                  <SelectTrigger className={`h-11 rounded-xl border-foreground/10 bg-foreground/[0.05] ${LOSSLESS.has(selectedFormat) ? "opacity-40" : ""}` }>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {qualities.map((q) => (
                      <SelectItem key={q.value} value={q.value}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleDownloadAll}
                disabled={isDownloadingAll || tracks.length === 0}
                className="sm:mb-0 h-11 px-6 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold shadow-[0_0_25px_-4px_hsl(var(--foreground)/0.2)] transition-all active:scale-[0.98] disabled:opacity-40"
              >
                <Download className="w-4 h-4 mr-2" />
                Download All ({tracks.length})
              </Button>
            </div>

            {isDownloadingAll && (() => {
              const isFinding = statusMessage.startsWith("Finding tracks");
              return (
                <div className="space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[80%]">
                      {statusMessage || "Starting…"}
                    </span>
                    {!isFinding && (
                      <span className="font-semibold text-foreground shrink-0 ml-2">{downloadProgress}%</span>
                    )}
                  </div>
                  {isFinding ? (
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full w-1/3 rounded-full bg-primary animate-[slide_1.4s_ease-in-out_infinite]" style={{ animation: "slidebar 1.4s ease-in-out infinite" }} />
                    </div>
                  ) : (
                    <Progress value={downloadProgress} className="h-2" />
                  )}
                </div>
              );
            })()}

            {downloadingId && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Downloading single track...
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              💡 Drag tracks to reorder • Hover a track to download it individually or remove it
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
};
