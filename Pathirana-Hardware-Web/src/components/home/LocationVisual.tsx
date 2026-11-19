"use client";

import { ThreeCanvas } from "@/components/three/ThreeCanvas";
import { locationScene } from "@/components/three/scenes";

/** Floating 3D map card with a bobbing pin, ripples and a gold route (static SVG fallback). */
export function LocationVisual({ className = "h-48 w-full min-[480px]:h-56 sm:h-64 lg:h-72" }: { className?: string }) {
  return (
    <ThreeCanvas
      create={locationScene}
      stillTime={0.6}
      className={className}
      fallback={
        <svg viewBox="0 0 240 150" className="h-full w-full" fill="none">
          <path d="M30 70L120 30L210 70L120 112Z" fill="#EFE9D8" stroke="#D9D1BD" strokeWidth="2" />
          <path d="M58 82L172 40M86 96L196 56M60 58L150 98" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
          <path d="M75 76L180 63" stroke="#F6DC8F" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="120" cy="80" rx="26" ry="9" stroke="#E8BE4F" strokeWidth="2" />
          <path d="M120 78C120 78 100 56 100 44A20 20 0 0 1 140 44C140 56 120 78 120 78Z" fill="#E3101A" />
          <circle cx="120" cy="44" r="7" fill="#fff" />
        </svg>
      }
    />
  );
}
