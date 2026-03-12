import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeftRight, Youtube, Music2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Direction = "spotify-to-youtube" | "youtube-to-spotify";

interface ConvertSectionProps {
  onConvert: (url: string) => void;
  isLoading?: boolean;
}

export const ConvertSection = ({ onConvert, isLoading = false }: ConvertSectionProps) => {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [direction, setDirection] = useState<Direction>("spotify-to-youtube");
  const [error, setError] = useState<string | null>(null);

  const isSpotifyFirst = direction === "spotify-to-youtube";

  const swapDirection = () => {
    setDirection((d) =>
      d === "spotify-to-youtube" ? "youtube-to-spotify" : "spotify-to-youtube"
    );
    setPlaylistUrl("");
    setError(null);
  };

  const handleConvert = async () => {
    setError(null);
    const url = playlistUrl.trim();
    if (!url) {
      setError("Please enter a playlist URL.");
      return;
    }

    const isSpotify = url.includes("spotify.com");
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

    if (!isSpotify && !isYoutube) {
      setError("Please enter a valid Spotify or YouTube playlist URL.");
      return;
    }

    if (isSpotifyFirst && !isSpotify) {
      setError("You selected Spotify→YouTube but pasted a YouTube URL. Swap the direction or paste a Spotify link.");
      return;
    }
    if (!isSpotifyFirst && !isYoutube) {
      setError("You selected YouTube→Spotify but pasted a Spotify URL. Swap the direction or paste a YouTube link.");
      return;
    }

    toast.info(`Fetching ${isSpotify ? "Spotify" : "YouTube"} playlist — this may take a moment for large playlists...`);
    onConvert(url);
  };

  const placeholderText = isSpotifyFirst
    ? "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
    : "https://www.youtube.com/playlist?list=PLxxxxxx";

  return (
    <section className="w-full animate-fade-in">
      <div className="max-w-3xl mx-auto">

        {/* Glass panel */}
        <div className="relative rounded-3xl glass-strong glow-white p-8 overflow-hidden">
          {/* Subtle inner glow top edge */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

          <div className="text-center mb-8">
            <h2 className="text-3xl font-black tracking-tight mb-3">
              <span className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                Download Your Playlist
              </span>
            </h2>
            <p className="text-muted-foreground text-sm">
              Paste a Spotify or YouTube playlist URL — get every song as MP3, FLAC, WAV, or M4A
            </p>

            {/* Legal disclaimer */}
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-foreground/[0.12] bg-foreground/[0.04] px-4 py-3 text-left">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-foreground/40" />
              <p className="text-xs text-foreground/50 leading-relaxed">
                <span className="font-semibold text-foreground/70">We do not store music.</span>{" "}
                BeatDrop does not host, store, or distribute any audio files. Tracks are sourced
                on-demand from public platforms and sent directly to your browser. You are solely
                responsible for ensuring your downloads comply with copyright law in your
                jurisdiction.{" "}
                <a href="/terms" className="underline underline-offset-2 hover:text-foreground/80 transition-colors">
                  Terms of Service
                </a>
              </p>
            </div>
          
          </div>

          {/* Direction indicator + swap */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                isSpotifyFirst
                  ? "bg-foreground/10 border-foreground/20 text-foreground"
                  : "bg-foreground/[0.03] border-foreground/[0.07] text-muted-foreground"
              }`}
            >
              <Music2 className="w-4 h-4 flex-shrink-0 opacity-70" />
              <span className="text-sm font-medium">Spotify</span>
            </div>

            <button
              onClick={swapDirection}
              title="Swap direction"
              className="flex-shrink-0 w-9 h-9 rounded-full glass border border-foreground/15 hover:bg-foreground/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-foreground/60" />
            </button>

            <div
              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                !isSpotifyFirst
                  ? "bg-foreground/10 border-foreground/20 text-foreground"
                  : "bg-foreground/[0.03] border-foreground/[0.07] text-muted-foreground"
              }`}
            >
              <Youtube className="w-4 h-4 flex-shrink-0 opacity-70" />
              <span className="text-sm font-medium">YouTube</span>
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <Alert variant="destructive" className="mb-4 rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Input
              type="text"
              placeholder={placeholderText}
              value={playlistUrl}
              onChange={(e) => {
                setPlaylistUrl(e.target.value);
                if (error) setError(null);
              }}
              className="h-13 text-sm rounded-xl bg-foreground/[0.05] border-foreground/10 placeholder:text-muted-foreground/50 focus-visible:ring-foreground/20 focus-visible:border-foreground/20"
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleConvert()}
              disabled={isLoading}
            />
            <Button
              onClick={handleConvert}
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold tracking-tight shadow-[0_0_30px_-4px_hsl(var(--foreground)/0.2)] transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.15s]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:0.3s]"></div>
                  <span className="ml-1">Loading playlist…</span>
                </div>
              ) : (
                <>Download Playlist — Unlimited Songs</>
              )}
            </Button>
          </div>

          {/* Trust pills */}
          <div className="mt-6 flex items-center justify-center gap-5 text-xs text-muted-foreground/60">
            {["No Login Required", "Free Forever", "Unlimited Songs"].map((tag) => (
              <div key={tag} className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-foreground/30" />
                <span>{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
