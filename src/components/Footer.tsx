import { Music2, Github, Heart } from "lucide-react";
import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="w-full mt-16 border-t border-foreground/[0.06]">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4 opacity-80 hover:opacity-100 transition-opacity">
              <Music2 className="w-4 h-4 text-foreground/60" />
              <span className="font-bold text-base text-foreground/80">BeatDrop</span>
            </Link>
            <p className="text-sm text-muted-foreground/60 leading-relaxed">
              Download playlists from Spotify and YouTube into your local library.
              We do not store, host, or distribute any music files.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-foreground/50 uppercase tracking-widest mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: "About", href: "/about" },
                { label: "Help & FAQ", href: "/#help" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Privacy Policy", href: "/privacy" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link to={href} className="text-muted-foreground/50 hover:text-foreground/80 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm text-foreground/50 uppercase tracking-widest mb-4">Connect</h3>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg glass border border-foreground/10 hover:bg-foreground/10 flex items-center justify-center transition-colors"
              >
                <Github className="w-4 h-4 text-foreground/50" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-foreground/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/40">
          <p>© 2026 BeatDrop. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-foreground/30 fill-foreground/30 mx-0.5" /> for music lovers
          </p>
        </div>
      </div>
    </footer>
  );
};
