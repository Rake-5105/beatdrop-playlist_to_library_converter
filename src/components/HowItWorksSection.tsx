import { Link2, RotateCcw, ListMusic, Download } from "lucide-react";

const steps = [
  {
    icon: Link2,
    step: "01",
    title: "Paste Your URL",
    description:
      "Copy the link to any public Spotify or YouTube playlist and paste it into the input field.",
  },
  {
    icon: RotateCcw,
    step: "02",
    title: "Load Playlist",
    description:
      "Click Download Playlist. We fetch every track — no limit on the number of songs.",
  },
  {
    icon: ListMusic,
    step: "03",
    title: "Preview & Reorder",
    description:
      "Browse your full playlist, search by track or artist, and drag-and-drop to reorder tracks.",
  },
  {
    icon: Download,
    step: "04",
    title: "Download",
    description:
      "Choose MP3 (recommended), FLAC, WAV, or M4A, then download all tracks or any individual song.",
  },
];

export const HowItWorksSection = () => {
  return (
    <section className="w-full animate-fade-in" id="about">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black tracking-tight">
            <span className="bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground/60">Four simple steps to your music.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map(({ icon: Icon, step, title, description }, i) => (
            <div
              key={i}
              className="relative flex flex-col gap-4 p-6 rounded-2xl glass glow-white-sm hover:glow-white transition-all duration-300 group overflow-hidden"
            >
              {/* Large step number watermark */}
              <span className="absolute top-3 right-4 text-5xl font-black text-foreground/[0.04] select-none leading-none">
                {step}
              </span>

              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-foreground/[0.07] border border-foreground/10 flex items-center justify-center group-hover:bg-foreground/[0.11] transition-colors">
                <Icon className="w-5 h-5 text-foreground/60" />
              </div>

              <h3 className="font-semibold text-sm text-foreground/85">{title}</h3>
              <p className="text-xs text-muted-foreground/60 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
