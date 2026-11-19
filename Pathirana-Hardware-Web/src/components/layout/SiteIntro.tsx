import { Logo } from "@/components/ui/Logo";

/**
 * Branded intro shown once per browser-tab session (CEO review #01).
 *
 * Safe by construction:
 *  • Pure CSS: the overlay fades itself out ~0.85 s after first paint and
 *    never captures clicks, so a script failure can never trap visitors.
 *  • It waits for nothing (no images, Three.js or network) — the page renders
 *    underneath from the first byte.
 *  • The inline script runs before the overlay is parsed: on later page loads
 *    in the same tab session it marks <html> so the overlay is never painted.
 *    Client-side navigation keeps the root layout, so it never replays there.
 *  • Hidden for prefers-reduced-motion and in print.
 */
const SEEN_SCRIPT = `try{var s=sessionStorage;if(s.getItem("ph-intro"))document.documentElement.classList.add("intro-seen");else s.setItem("ph-intro","1")}catch(e){document.documentElement.classList.add("intro-seen")}`;

export function SiteIntro() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SEEN_SCRIPT }} />
      <div aria-hidden="true" className="site-intro">
        <div className="site-intro-inner">
          <Logo tone="mark" className="site-intro-logo h-16 sm:h-20" preload alt="" sizes="128px" />
          <p className="site-intro-name font-display text-[clamp(1.6rem,7vw,2.4rem)] font-semibold whitespace-nowrap text-white">
            Pathirana Hardware
          </p>
          <span className="site-intro-line" />
        </div>
      </div>
    </>
  );
}
