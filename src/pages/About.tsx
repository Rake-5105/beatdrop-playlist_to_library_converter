import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Music2, Zap, Shield, Heart } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl space-y-10">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl glass border border-foreground/15 flex items-center justify-center mx-auto">
            <Music2 className="w-8 h-8 text-foreground/70" />
          </div>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
            About BeatDrop
          </h1>
          <p className="text-lg text-muted-foreground">
            A free, privacy-first tool for music lovers everywhere.
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <div className="rounded-2xl glass border border-foreground/[0.08] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-foreground/50" />
              <h2 className="text-xl font-bold m-0">What is BeatDrop?</h2>
            </div>
            <p className="text-muted-foreground">
              BeatDrop is a tool that lets you convert Spotify and YouTube playlists into a local
              audio library in formats like MP3, WAV, and FLAC. Audio is generated on-demand and
              delivered directly to your browser — we never store, host, or distribute music files.
            </p>
          </div>

          <div className="rounded-2xl glass border border-foreground/[0.08] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-foreground/50" />
              <h2 className="text-xl font-bold m-0">Privacy First</h2>
            </div>
            <p className="text-muted-foreground">
              We do not run a backend database and we do not store any audio files on our servers.
              Your playlist URLs and download history are stored exclusively in your browser's{" "}
              <code className="bg-foreground/[0.07] border border-foreground/10 px-1 rounded text-sm">localStorage</code>.
              No analytics, no tracking, no account required.
            </p>
          </div>

          <div className="rounded-2xl glass border border-foreground/[0.08] p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-destructive fill-destructive" />
              <h2 className="text-xl font-bold m-0">Made for Music Lovers</h2>
            </div>
            <p className="text-muted-foreground">
              This project was built out of frustration with tools that require sign-ups, impose
              download limits, or bombard you with ads. BeatDrop is and will remain free,
              fast, and open.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
