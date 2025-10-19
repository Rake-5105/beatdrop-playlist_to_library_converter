import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Music, Trash2, Edit3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
}

interface PlaylistPreviewProps {
  tracks: Track[];
  onDownload: (format: string) => void;
}

export const PlaylistPreview = ({ tracks, onDownload }: PlaylistPreviewProps) => {
  const [selectedFormat, setSelectedFormat] = useState("mp3");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const formats = [
    { value: "mp3", label: "MP3 (High Quality)" },
    { value: "wav", label: "WAV (Lossless)" },
    { value: "flac", label: "FLAC (Lossless)" },
    { value: "m4a", label: "M4A (AAC)" },
    { value: "aac", label: "AAC" },
  ];

  const handleDownload = () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsDownloading(false);
          toast.success("Download complete! 🎉");
          onDownload(selectedFormat);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <section className="w-full animate-slide-up">
      <div className="max-w-5xl mx-auto">
        <Card className="rounded-2xl shadow-card border-border overflow-hidden">
          <div className="bg-gradient-to-r from-accent/50 to-secondary/50 px-6 py-4 border-b border-border">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              Playlist Preview
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {tracks.length} tracks
              </span>
            </h3>
          </div>

          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-accent/20 transition-colors group"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-semibold text-primary">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{track.title}</h4>
                  <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-accent/10 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Download Format</label>
                <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                  <SelectTrigger className="h-11 rounded-xl border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="sm:mt-6 h-11 px-8 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold shadow-soft"
              >
                <Download className="w-4 h-4 mr-2" />
                Download All
              </Button>
            </div>

            {isDownloading && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Downloading...</span>
                  <span className="font-semibold text-primary">{downloadProgress}%</span>
                </div>
                <Progress value={downloadProgress} className="h-2" />
              </div>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
};
