import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Youtube, Music2 } from "lucide-react";
import { toast } from "sonner";

export const ConvertSection = ({ onConvert }: { onConvert: (url: string) => void }) => {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = async () => {
    if (!playlistUrl.trim()) {
      toast.error("Please enter a playlist URL");
      return;
    }

    const isSpotify = playlistUrl.includes("spotify.com");
    const isYoutube = playlistUrl.includes("youtube.com") || playlistUrl.includes("youtu.be");

    if (!isSpotify && !isYoutube) {
      toast.error("Please enter a valid Spotify or YouTube playlist URL");
      return;
    }

    setIsConverting(true);
    toast.success(`Converting ${isSpotify ? "Spotify" : "YouTube"} playlist...`);
    
    setTimeout(() => {
      onConvert(playlistUrl);
      setIsConverting(false);
    }, 1500);
  };

  return (
    <section className="w-full animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="bg-card rounded-2xl shadow-card border border-border p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Convert Your Playlist
            </h2>
            <p className="text-muted-foreground">
              Paste a Spotify or YouTube playlist URL to get started
            </p>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-accent/30 rounded-xl border border-border/50">
              <Music2 className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Spotify</span>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-secondary/50 rounded-xl border border-border/50">
              <Youtube className="w-5 h-5 text-destructive" />
              <span className="text-sm font-medium">YouTube</span>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              type="text"
              placeholder="https://open.spotify.com/playlist/... or https://youtube.com/playlist?list=..."
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              className="h-14 text-base rounded-xl border-border/50 focus-visible:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && handleConvert()}
            />
            <Button
              onClick={handleConvert}
              disabled={isConverting}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold shadow-soft"
            >
              {isConverting ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground animate-bounce-subtle"></div>
                  <span>Converting...</span>
                </div>
              ) : (
                <>Convert Playlist</>
              )}
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
              <span>No Login Required</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
              <span>Free Forever</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
              <span>Fast & Secure</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
