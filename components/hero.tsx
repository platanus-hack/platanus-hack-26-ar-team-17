"use client";

import { useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";
import Link from "next/link";

export function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* MeshGradient shader background - light lime colors */}
      <MeshGradient
        className="absolute inset-0 w-full h-full"
        colors={["#000000", "#1a2e05", "#3f6212", "#84cc16", "#bef264"]}
        speed={0.15}
      />

      {/* Zero text with manifestation effect */}
      <div className="relative z-10 flex flex-col items-center">
        <h1 
          className="text-[22vw] md:text-[20vw] lg:text-[18vw] font-medium tracking-tighter text-white/90 select-none leading-none"
          style={{
            textShadow: '0 0 80px rgba(163, 230, 53, 0.15), 0 0 120px rgba(163, 230, 53, 0.1)',
          }}
        >
          <span 
            className={`inline-block transition-all duration-[2000ms] ease-out ${
              isVisible 
                ? "opacity-100 blur-0 scale-100" 
                : "opacity-0 blur-xl scale-95"
            }`}
          >
            zero
          </span>
          <span 
            className={`inline-block text-lime-400 transition-all duration-[1500ms] ease-out delay-[2000ms] ${
              isVisible 
                ? "opacity-100 blur-0 scale-100" 
                : "opacity-0 blur-xl scale-50"
            }`}
          >
            .
          </span>
        </h1>
        <p 
          className={`font-mono text-sm md:text-base lg:text-lg text-white/70 tracking-widest mt-4 transition-all duration-[2000ms] ease-out delay-[3500ms] ${
            isVisible 
              ? "opacity-100 blur-0 translate-y-0" 
              : "opacity-0 blur-md translate-y-4"
          }`}
        >
          the identity layer for the agentic internet
        </p>
        <Link
          href="/onboard"
          className={`mt-10 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-8 py-3 font-mono text-sm text-white/90 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-[2000ms] ease-out delay-[4000ms] hover:bg-white/10 hover:border-white/30 hover:text-white ${
            isVisible
              ? "opacity-100 blur-0 translate-y-0"
              : "opacity-0 blur-md translate-y-4"
          }`}
        >
          get started
        </Link>
      </div>

      {/* Subtle vignette effect */}
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{
        background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 0%, rgba(0, 0, 0, 0.4) 100%)',
      }} />
    </section>
  );
}
