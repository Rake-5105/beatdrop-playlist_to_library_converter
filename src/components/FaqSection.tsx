import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "Is this service completely free?",
    a: "Yes — BeatDrop is 100% free. There are no hidden fees, subscriptions, or premium tiers. All features are available to every user.",
  },
  {
    q: "Do I need to create an account or log in?",
    a: "No account or login is required. Simply paste your playlist URL, click Convert, and you're done. We don't store your data in any database.",
  },
  {
    q: "How many songs can I convert or download at once?",
    a: "There's no limit. Whether your playlist has 10 songs or 10,000 songs, BeatDrop will process every single track. The paginated API fetching ensures all tracks are retrieved.",
  },
  {
    q: "Which audio formats are supported for download?",
    a: "We support MP3, WAV, FLAC, M4A, and AAC. You can select your preferred format before downloading, and you can also download individual tracks independently.",
  },
  {
    q: "How does Spotify ↔ YouTube conversion work?",
    a: "When you paste a Spotify URL, we read the track names and artists, then match them on YouTube. For YouTube playlists, we extract video titles and map them to their audio equivalents. The conversion runs entirely in your browser — no data is sent to our servers.",
  },
  {
    q: "Can I reorder tracks before downloading?",
    a: "Yes! In the playlist preview, you can drag and drop tracks to reorder them before starting the download. Your custom order is preserved.",
  },
  {
    q: "Is there a history of my conversions?",
    a: "Yes — your last 50 conversions are automatically saved in your browser's local storage. You can access them on the History page. This data never leaves your device.",
  },
  {
    q: "Are there any copyright concerns?",
    a: "Please only download music you have the legal right to download. Downloading copyrighted music without permission may violate copyright law in your country. Always respect artists' rights.",
  },
];

export const FaqSection = () => {
  return (
    <section className="w-full animate-fade-in" id="help">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium text-foreground/50 mb-4">
            <HelpCircle className="w-3.5 h-3.5 opacity-60" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight">
            <span className="bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
              Got Questions?
            </span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground/60">Everything you need to know about BeatDrop.</p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="glass rounded-xl px-5 border border-foreground/[0.08] shadow-none"
            >
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline py-4 text-foreground/80 hover:text-foreground">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground/60 pb-4 leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
