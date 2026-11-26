/**
 * Gold architectural line-art skyline (decorative): scaffolded building,
 * towers, houses, a tower crane, bricks and pipes — the same thin-stroke style
 * as the Get in Touch line-art. Always shown WHOLE at its natural 1440:150 ratio
 * (no cropping: cropped tops/sides left broken joins and gaps), with the ground
 * line on the bottom edge so it forms one continuous baseline, and strokes of
 * even width at every size (non-scaling strokes).
 */
export function ConstructionSkyline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 150"
      preserveAspectRatio="xMidYMax meet"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`skyline-art ${className}`}
    >
      {/* Everything shifted down 2.4 units: the ground line sits on the bottom edge. */}
      <g transform="translate(0 2.4)">
        {/* Ground */}
        <path d="M0 146H1440" />
        {/* Scaffolded building */}
        <path d="M60 146V58H190V146M60 88H190M60 118H190M95 58V146M155 58V146M50 146V48M200 146V48M50 48H200M50 78H60M190 78H200M50 108H60M190 108H200" />
        <path d="M70 40V58M180 34V58M176 34H184" />
        {/* Towers */}
        <path d="M230 146V40H282V146M240 52H250M262 52H272M240 68H250M262 68H272M240 84H250M262 84H272M240 100H250M262 100H272M240 116H250M262 116H272M250 146V128H262V146" />
        <path d="M300 146V82H340V146M310 94H330M310 108H330M310 122H330" />
        {/* Houses */}
        <path d="M380 146V106L425 76L470 106V146M380 106H470M412 146V122H438V146M392 114H404M446 114H458" />
        <path d="M500 146V114L530 94L560 114V146M520 146V128H540V146" />
        <path d="M610 146V100L668 64L726 100V146M610 100H726M650 146V118H686V146M624 110H640M696 110H712" />
        <path d="M750 146V118L776 100L802 118V146M768 146V132H784V146" />
        {/* Tower crane with a suspended load */}
        <path d="M940 146V26M956 146V26M940 26H956M940 146L956 120M956 146L940 120M940 120L956 96M956 120L940 96M940 96L956 72M956 96L940 72M940 72L956 48M956 72L940 48M940 48L956 26" />
        <path d="M850 26H1110M870 26L948 8L1100 26M948 8V26M870 26V34H898V26M1060 26V58M1046 58H1074V70H1046Z" />
        {/* Building under construction */}
        <path d="M1140 146V70H1220V146M1140 92H1220M1140 116H1220M1166 70V146M1194 70V146M1150 70V58M1210 70V58" />
        {/* Bricks */}
        <path d="M1250 146V134H1290V146M1270 134V146M1258 134V122H1298V134M1278 122V134M1290 146H1330V134H1290" />
        {/* Pipes */}
        <path d="M1350 146A8 8 0 1 0 1350 130A8 8 0 1 0 1350 146ZM1368 146A8 8 0 1 0 1368 130A8 8 0 1 0 1368 146ZM1359 130A8 8 0 1 0 1359 114A8 8 0 1 0 1359 130Z" />
        <path d="M1350 130H1430M1350 146H1430M1368 114H1420" />
      </g>
    </svg>
  );
}
