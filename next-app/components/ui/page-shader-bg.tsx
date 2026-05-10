'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import { useEffect, useState } from 'react';

interface PageShaderBgProps {
  colors?: string[];
  distortion?: number;
  swirl?: number;
  speed?: number;
  offsetX?: number;
  /** 0–1, how much to dim the shader so foreground text stays readable. */
  veilOpacity?: number;
}

/**
 * Fixed, full-viewport shader backdrop for long content pages — pairs with the
 * same palette as <HeroSection> but doesn't impose flex/center layout, so it
 * sits cleanly behind scrollable docs/dashboard content.
 */
export function PageShaderBg({
  colors = ['#c8f542', '#8aa830', '#050505', '#1a2400', '#d4f75e', '#3a4a00'],
  distortion = 1.0,
  swirl = 0.7,
  speed = 0.45,
  offsetX = 0.08,
  veilOpacity = 0.62,
}: PageShaderBgProps) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <MeshGradient
        width={dimensions.width}
        height={dimensions.height}
        colors={colors}
        distortion={distortion}
        swirl={swirl}
        grainMixer={0}
        grainOverlay={0}
        speed={speed}
        offsetX={offsetX}
      />
      <div style={{ position: 'absolute', inset: 0, background: `rgba(5,5,5,${veilOpacity})` }} />
    </div>
  );
}
