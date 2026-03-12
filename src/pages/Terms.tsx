import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ShieldAlert } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight mb-2 bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mb-8 text-sm">Last updated: March 12, 2026</p>

        {/* Prominent notice */}
        <div className="flex items-start gap-4 rounded-2xl border border-foreground/20 bg-foreground/[0.05] p-5 mb-10">
          <ShieldAlert className="w-6 h-6 mt-0.5 flex-shrink-0 text-foreground/60" />
          <div className="space-y-1">
            <p className="font-bold text-foreground text-sm">Important Legal Notice</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              BeatDrop is a self-hosted download assistant. We do not store, host, cache, or
              distribute any copyrighted audio content. All audio is retrieved on-demand from
              public third-party platforms (YouTube) and streamed directly to your device.
              <strong className="text-foreground/80"> You — the user — are solely responsible
              for how you use this service.</strong> Downloading copyrighted content without
              the rights holder's permission may violate applicable law in your country.
            </p>
          </div>
        </div>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>
              By using BeatDrop ("the Service"), you agree to these Terms of Service. If you
              do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">2. User Responsibility</h2>
            <p className="mb-3">
              You are <strong className="text-foreground/80">solely and fully responsible</strong> for
              all content you download using the Service. By using BeatDrop, you confirm that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You have the legal right to download the content you request.</li>
              <li>You will only download music for personal, non-commercial use unless you hold the appropriate licence.</li>
              <li>You understand that downloading copyrighted material without authorisation may violate the laws of your jurisdiction.</li>
              <li>You accept full legal liability for any copyright infringement resulting from your use of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">3. No Music Storage</h2>
            <p>
              BeatDrop does not store, cache, host, or redistribute any audio files. When you
              initiate a download, audio is retrieved from public third-party platforms (e.g.
              YouTube) and passed directly to your browser as a temporary stream. No audio file
              is ever written to or retained on our servers beyond the duration of your request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">4. Copyright &amp; Intellectual Property</h2>
            <p>
              The Service is provided as a technical tool only. We do not make any representations
              about the legality of downloading any particular track in your jurisdiction. It is
              your responsibility to determine whether use of the Service complies with all
              applicable copyright laws, platform terms of service (including those of Spotify
              and YouTube), and any other relevant regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">5. Third-Party Platforms</h2>
            <p>
              BeatDrop uses official Spotify and YouTube APIs to retrieve playlist metadata, and
              public video sources to stream audio. Your use of those platforms is independently
              governed by their respective terms of service. BeatDrop is not affiliated with,
              endorsed by, or sponsored by Spotify, YouTube, or any other platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">6. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" without any warranties of any kind. We make no
              guarantees regarding uptime, accuracy, or availability of third-party APIs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, BeatDrop and its operators shall not be
              liable for any indirect, incidental, consequential, or statutory damages arising
              from your use of the Service, including any liability arising from copyright
              infringement by the user.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-3">8. Changes to Terms</h2>
            <p>
              We may update these Terms at any time. Continued use of the Service after changes
              constitutes acceptance of the revised Terms.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;

