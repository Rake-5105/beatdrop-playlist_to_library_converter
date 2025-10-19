import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ConvertSection } from "@/components/ConvertSection";
import { PlaylistPreview } from "@/components/PlaylistPreview";
import { Footer } from "@/components/Footer";

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
}

const Index = () => {
  const [convertedTracks, setConvertedTracks] = useState<Track[]>([]);

  const handleConvert = (url: string) => {
    // Mock tracks for demonstration
    const mockTracks: Track[] = [
      {
        id: "1",
        title: "Midnight Dreams",
        artist: "Luna Echo",
        thumbnail: "",
      },
      {
        id: "2",
        title: "Summer Vibes",
        artist: "Coastal Beats",
        thumbnail: "",
      },
      {
        id: "3",
        title: "Neon Lights",
        artist: "City Pulse",
        thumbnail: "",
      },
      {
        id: "4",
        title: "Golden Hour",
        artist: "Sunset Collective",
        thumbnail: "",
      },
      {
        id: "5",
        title: "Electric Soul",
        artist: "Rhythm Masters",
        thumbnail: "",
      },
    ];

    setConvertedTracks(mockTracks);
  };

  const handleDownload = (format: string) => {
    console.log(`Downloading in ${format} format`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-accent/5 to-secondary/10">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-12">
        <HeroSection />
        <ConvertSection onConvert={handleConvert} />
        {convertedTracks.length > 0 && (
          <PlaylistPreview tracks={convertedTracks} onDownload={handleDownload} />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Index;
