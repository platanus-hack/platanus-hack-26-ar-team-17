"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import Onboarding from "../components/Onboarding";

export default function OnboardPage() {
  return (
    <div className="onboarding-scope relative min-h-screen overflow-hidden bg-black">
      {/* left half — static darkish lime green */}
      <div
        className="fixed inset-y-0 left-0 w-1/2"
        style={{
          background:
            "linear-gradient(160deg, #0a1505 0%, #1a2e05 60%, #2a4a08 100%)",
        }}
      />
      {/* right half — animated mesh gradient */}
      <div className="fixed inset-y-0 right-0 w-1/2 overflow-hidden">
        <MeshGradient
          className="absolute inset-0 w-full h-full"
          colors={["#000000", "#0a1505", "#1f3309", "#3f6212", "#84cc16"]}
          speed={0.1}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 0%, rgba(0,0,0,0.5) 100%)",
          }}
        />
      </div>
      <div className="relative z-10">
        <Onboarding />
      </div>
    </div>
  );
}
