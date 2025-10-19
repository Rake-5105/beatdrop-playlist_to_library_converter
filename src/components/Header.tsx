import { Music } from "lucide-react";

export const Header = () => {
  return (
    <header className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-soft">
              <Music className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Playlist Portal
              </h1>
              <p className="text-xs text-muted-foreground">Convert & Download Your Music</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/50 text-xs font-medium text-accent-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-slow"></span>
              Free & No Login Required
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
