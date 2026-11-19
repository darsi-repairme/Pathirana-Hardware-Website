import { InView } from "@/components/ui/InView";

/**
 * Architectural blueprint line-art with "Build Better… Live Better…".
 * Sequence (every time it scrolls into view — `.blueprint` in globals.css):
 * 1. "Build Better..." rises in word by word · 2. "Live Better..." follows ·
 * 3. the gold underline draws left → right · 4. the ground line, buildings and
 * crane draw · 5. the crane beacon glows. Resets when scrolled fully away.
 * Static and fully visible under reduced motion / without JS.
 */
export function BlueprintArt({ className = "" }: { className?: string }) {
  return (
    <InView className={`blueprint relative ${className}`}>
      <p className="bp-words font-display text-[1.9rem] leading-tight font-semibold whitespace-nowrap text-forest italic sm:text-[2.1rem] xl:text-[1.85rem] 2xl:text-[2.1rem]">
        <span className="block">
          <span className="bp-word bp-w1">Build</span> <span className="bp-word bp-w2">Better...</span>
        </span>
        <span className="block pl-8">
          <span className="bp-word bp-w3">Live</span> <span className="bp-word bp-w4">Better...</span>
        </span>
      </p>
      <svg
        viewBox="0 0 320 170"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className="mt-1 block h-auto w-full text-forest/45"
      >
        {/* Gold underline beneath the words */}
        <path className="bp-gold" pathLength={1} d="M18 8C80 2 150 2 220 8" stroke="#B8860B" strokeWidth="2" />
        {/* Ground line */}
        <path className="bp-ground" pathLength={1} d="M4 166H316" />
        {/* Buildings */}
        <g className="bp-b">
          <path pathLength={1} d="M14 166V104H50V166" />
          <path pathLength={1} d="M22 114H30M36 114H44M22 128H30M36 128H44M22 142H30M36 142H44" />
        </g>
        <g className="bp-b">
          <path pathLength={1} d="M58 166V64H94V166M76 64V48" />
          <path
            pathLength={1}
            d="M66 76H72M80 76H86M66 92H72M80 92H86M66 108H72M80 108H86M66 124H72M80 124H86M66 140H72M80 140H86"
          />
        </g>
        <g className="bp-b">
          <path pathLength={1} d="M102 166V112L130 92L158 112V166" />
          <path pathLength={1} d="M124 166V146H136V166M112 122H120V130H112ZM140 122H148V130H140Z" />
        </g>
        <g className="bp-b">
          <path pathLength={1} d="M166 166V80H200V166" />
          <path
            pathLength={1}
            d="M174 92H180M186 92H192M174 108H180M186 108H192M174 124H180M186 124H192M174 140H180M186 140H192"
          />
        </g>
        <g className="bp-b">
          <path pathLength={1} d="M208 166V124H236V166" />
          <path pathLength={1} d="M214 134H220M226 134H230M214 148H220M226 148H230" />
        </g>
        {/* Crane */}
        <g className="bp-crane">
          <path pathLength={1} d="M258 166V40M270 166V40" />
          <path pathLength={1} d="M258 160L270 146L258 132L270 118L258 104L270 90L258 76L270 62L258 48" />
          <path pathLength={1} d="M240 40H316M264 40V28L240 40M264 28L316 40" />
          <path pathLength={1} d="M240 40V48H252V40M306 40V72M306 72C306 78 299 78 299 74" />
        </g>
        {/* Beacon light on the crane */}
        <circle className="bp-beacon" cx="264" cy="27" r="2.6" fill="#E8BE4F" stroke="none" />
      </svg>
    </InView>
  );
}
