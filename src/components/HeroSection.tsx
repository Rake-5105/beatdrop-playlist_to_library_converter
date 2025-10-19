import { Music2, Youtube, Download, Zap } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="w-full py-12 sm:py-16 animate-fade-in">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-border/50 text-sm font-medium mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <span>Free, Fast, and No Login Required</span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
          Convert Playlists Between
          <br />
          <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
            Spotify & YouTube
          </span>
        </h1>
        
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Seamlessly transfer your favorite playlists and download them in high-quality audio formats. 
          All processing happens instantly, with no database or sign-up needed.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 max-w-2xl mx-auto">
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/50 border border-border/50 hover:shadow-card transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Music2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold">Convert Playlists</h3>
            <p className="text-xs text-muted-foreground text-center">
              Spotify ↔ YouTube in seconds
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/50 border border-border/50 hover:shadow-card transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/40 to-accent/20 flex items-center justify-center">
              <Download className="w-6 h-6 text-accent-foreground" />
            </div>
            <h3 className="font-semibold">Download Songs</h3>
            <p className="text-xs text-muted-foreground text-center">
              MP3, WAV, FLAC & more
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/50 border border-border/50 hover:shadow-card transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/40 to-secondary/20 flex items-center justify-center">
              <Youtube className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="font-semibold">Batch Processing</h3>
            <p className="text-xs text-muted-foreground text-center">
              Handle 1000+ songs easily
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
