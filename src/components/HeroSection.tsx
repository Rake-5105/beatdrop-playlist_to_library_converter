import { Music2, Youtube, Download, Zap } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="w-full py-14 sm:py-20 animate-fade-in">
      <div className="max-w-4xl mx-auto text-center space-y-7">

        {/* Pill badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium text-foreground/70 mb-2">
          <Zap className="w-3.5 h-3.5 text-foreground/50" />
          <span>Free · Unlimited · No Login Required</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight">
          Download Any Playlist
          <br />
          <span className="bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
            as MP3, FLAC or WAV
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Paste a Spotify or YouTube playlist URL and get every track in the
          audio format you want — no sign-up, no limits, no MP4.
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 max-w-2xl mx-auto">
          {[
            {
              icon: Download,
              title: "Download Playlists",
              sub: "MP3 · FLAC · WAV · M4A",
            },
            {
              icon: Music2,
              title: "Spotify & YouTube",
              sub: "Paste any public playlist URL",
            },
            {
              icon: Youtube,
              title: "Unlimited Songs",
              sub: "10 or 10,000 tracks — no cap",
            },
          ].map(({ icon: Icon, title, sub }) => (
            <div
              key={title}
              className="relative flex flex-col items-center gap-3 p-6 rounded-2xl glass glow-white-sm hover:glow-white transition-all duration-300 group"
            >
              <div className="w-11 h-11 rounded-xl bg-foreground/[0.07] border border-foreground/10 flex items-center justify-center group-hover:bg-foreground/[0.11] transition-colors">
                <Icon className="w-5 h-5 text-foreground/70" />
              </div>
              <h3 className="font-semibold text-sm text-foreground/90">{title}</h3>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
