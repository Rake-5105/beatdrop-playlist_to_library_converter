import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ConvertSection } from "@/components/ConvertSection";
import { PlaylistPreview } from "@/components/PlaylistPreview";
import { PlaylistSkeleton } from "@/components/LoadingSkeleton";
import { FaqSection } from "@/components/FaqSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { Footer } from "@/components/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { convertPlaylist, type Track, type ConversionResult } from "@/lib/api";
import { addToHistory } from "@/lib/history";
import { toast } from "sonner";

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await convertPlaylist(url);
      setResult(data);
      // Save to history
      addToHistory({
        url,
        playlistName: data.playlistName,
        source: data.source,
        trackCount: data.totalCount,
        tracks: data.tracks,
      });
      toast.success(
        `Loaded "${data.playlistName}" — ${data.totalCount} tracks`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (format: string) => {
    console.log(`Downloading in ${format} format`);
  };

  const handleTracksChange = (tracks: Track[]) => {
    if (result) setResult({ ...result, tracks, totalCount: tracks.length });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-16">
        <HeroSection />
        <ConvertSection onConvert={handleConvert} isLoading={isLoading} />

        {/* Loading skeleton */}
        {isLoading && <PlaylistSkeleton />}

        {/* Error state */}
        {error && !isLoading && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Playlist preview */}
        {result && !isLoading && (
          <PlaylistPreview
            tracks={result.tracks}
            playlistName={result.playlistName}
            onDownload={handleDownload}
            onTracksChange={handleTracksChange}
          />
        )}

        <HowItWorksSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
