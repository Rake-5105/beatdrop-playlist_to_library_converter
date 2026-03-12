import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const Privacy = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight mb-2 bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-8 text-sm">Last updated: March 12, 2026</p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. No Data Collection</h2>
            <p>
              BeatDrop does not collect, store, or transmit any personal data to our servers.
              We operate with no user database. Your privacy is fully protected.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. No Audio Stored on Our Servers</h2>
            <p>
              BeatDrop does not retain any audio files on its servers. When you request a
              download, audio is retrieved on-demand from public third-party platforms (e.g.
              YouTube) and immediately streamed to your browser. Once the transfer is complete,
              the temporary data is discarded. At no point is any music file persisted, cached,
              or redistributed by BeatDrop.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. Local Storage</h2>
            <p>
              Download history is stored exclusively in your browser's{" "}
              <code className="bg-foreground/[0.07] border border-foreground/10 px-1 rounded text-sm">localStorage</code>. This data
              never leaves your device and can be cleared at any time from the History page or
              your browser's developer tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Third-Party APIs</h2>
            <p>
              When you load a playlist, your browser makes requests to official Spotify
              and YouTube APIs. These requests are governed by their respective privacy policies:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <a
                  href="https://www.spotify.com/legal/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/70 hover:text-foreground hover:underline"
                >
                  Spotify Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/70 hover:text-foreground hover:underline"
                >
                  Google / YouTube Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Cookies</h2>
            <p>
              We do not use cookies. We do not use tracking pixels, analytics, or advertising
              scripts of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. Changes to this Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Any changes will be reflected on this
              page with an updated date.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;

