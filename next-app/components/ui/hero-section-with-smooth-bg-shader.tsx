'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import { useEffect, useState } from 'react';

interface HeroSectionProps {
  colors?: string[];
  distortion?: number;
  swirl?: number;
  speed?: number;
  offsetX?: number;
  className?: string;
  veilOpacity?: string;
  children?: React.ReactNode;
}

export function HeroSection({
  colors = ['#c8f542', '#8aa830', '#050505', '#1a2400', '#d4f75e', '#3a4a00'],
  distortion = 1.0,
  swirl = 0.7,
  speed = 0.5,
  offsetX = 0.08,
  className = '',
  veilOpacity = 'bg-black/40',
  children,
}: HeroSectionProps) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <section
      className={`relative w-full min-h-screen overflow-hidden flex items-center justify-center ${className}`}
      style={{ background: '#050505' }}
    >
      <div className="fixed inset-0 w-screen h-screen">
        {mounted && (
          <>
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
            <div className={`absolute inset-0 pointer-events-none ${veilOpacity}`} />
          </>
        )}
      </div>

      <div className="relative z-10 w-full">{children}</div>
    </section>
  );
}
