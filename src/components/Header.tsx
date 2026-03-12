import { useState } from "react";
import { Menu, X, History, Home, HelpCircle, Info } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navLinks = [
  { label: "Home", href: "/", icon: Home },
  { label: "History", href: "/history", icon: History },
  { label: "How It Works", href: "/#about", icon: Info },
  { label: "FAQ", href: "/#help", icon: HelpCircle },
];

export const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="w-full sticky top-0 z-50">
      {/* Glass strip */}
      <div className="glass border-b border-foreground/[0.07]">
        <div className="container mx-auto px-4 py-3.5">
          <div className="flex items-center justify-between gap-4">

            {/* Brand */}
            <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <img src="/f.png" alt="BeatDrop logo" className="w-10 h-10 object-contain rounded-lg" />
              <div className="leading-none">
                <span className="block text-base font-black tracking-tight text-foreground/90">
                  BeatDrop
                </span>
                <span className="block text-[10px] text-foreground/35 mt-0.5">Playlist to Library Converter</span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {navLinks.map(({ label, href }) => {
                const isHash = href.startsWith("/#");
                const isActive = !isHash && (href === "/" ? location.pathname === "/" : location.pathname === href);
                const cls = `px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.06]"
                }`;
                return isHash ? (
                  <a key={label} href={href} className={cls}>{label}</a>
                ) : (
                  <Link key={label} to={href} className={cls}>{label}</Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-[11px] font-medium text-foreground/40">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-pulse" />
                Free &amp; No Login
              </div>
              <ThemeToggle />

              {/* Mobile hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden h-8 w-8 rounded-lg border border-foreground/10 bg-foreground/[0.05] hover:bg-foreground/10 text-foreground/60"
                    aria-label="Open menu"
                  >
                    {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 pt-12 glass border-foreground/10">
                  <nav className="flex flex-col gap-1">
                    {navLinks.map(({ label, href, icon: Icon }) => {
                      const isHash = href.startsWith("/#");
                      const isActive = !isHash && (href === "/" ? location.pathname === "/" : location.pathname === href);
                      const cls = `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-foreground/10 text-foreground"
                          : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.06]"
                      }`;
                      return isHash ? (
                        <a key={label} href={href} onClick={() => setMobileOpen(false)} className={cls}>
                          <Icon className="w-4 h-4" />
                          {label}
                        </a>
                      ) : (
                        <Link key={label} to={href} onClick={() => setMobileOpen(false)} className={cls}>
                          <Icon className="w-4 h-4" />
                          {label}
                        </Link>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
