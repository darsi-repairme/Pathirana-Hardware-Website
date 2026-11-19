/**
 * Decorative location illustration for dark-green bands: a stylised road with
 * a gold route and a map pin inside fine gold rings. Not a map — no
 * coordinates are implied.
 */
export function LocationArt({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 360 300"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <defs>
        <radialGradient id="loc-glow" cx="50%" cy="58%" r="50%">
          <stop offset="0" stopColor="#E8BE4F" stopOpacity="0.28" />
          <stop offset="1" stopColor="#E8BE4F" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="180" cy="170" r="128" fill="url(#loc-glow)" />
      <circle cx="180" cy="170" r="122" stroke="#E8BE4F" strokeOpacity="0.35" />
      <circle cx="180" cy="170" r="92" stroke="#E8BE4F" strokeOpacity="0.22" strokeDasharray="2 7" />
      {/* Roads */}
      <path d="M30 228C96 214 132 238 180 206S286 136 340 150" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="18" />
      <path d="M112 60L150 290" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="10" />
      {/* Gold route */}
      <path
        d="M30 228C96 214 132 238 180 206S286 136 340 150"
        stroke="#E8BE4F"
        strokeOpacity="0.85"
        strokeWidth="1.6"
        strokeDasharray="7 7"
      />
      {/* Pin */}
      <ellipse cx="180" cy="206" rx="26" ry="8" stroke="#E8BE4F" strokeOpacity="0.7" strokeWidth="1.5" />
      <path
        d="M180 202C180 202 150 168 150 146a30 30 0 0 1 60 0c0 22-30 56-30 56Z"
        fill="#B8860B"
        stroke="#F6DC8F"
        strokeWidth="1.6"
      />
      <circle cx="180" cy="146" r="10" fill="#072E1D" stroke="#F6DC8F" strokeWidth="1.4" />
    </svg>
  );
}
