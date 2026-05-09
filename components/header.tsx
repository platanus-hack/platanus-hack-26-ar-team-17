"use client";

import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Header() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show header after scrolling past the hero (100vh)
      const scrollY = window.scrollY;
      const heroHeight = window.innerHeight;
      setIsVisible(scrollY > heroHeight - 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <span className="font-medium text-xl text-white/90 tracking-tighter">zero</span>
            <span className="text-xl text-lime-400 font-medium">.</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono">
              How it Works
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono">
              Docs
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono">
              Pricing
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Github className="w-5 h-5" />
            <span className="sr-only">GitHub</span>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-mono hidden sm:inline-flex">
            <Link href="/onboard">Sign In</Link>
          </Button>
          <Button asChild size="sm" className="font-mono bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/onboard">Get Started</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
