"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * About › Our Location — "find our store" directions illustration (NOT the Home page's delivery
 * truck). A simplified, illustrative street map: a highlighted route draws itself from a start
 * marker, a gold marker travels along it, and the destination pin (Pathirana Hardware) settles
 * with a soft glow. Purely decorative — no real geography, distances or turn-by-turn details; the
 * "Get Directions" button opens Google Maps for real directions.
 *
 * Lightweight SVG/SMIL like the other site animations: runs only while visible and the tab is
 * shown; under prefers-reduced-motion everything is drawn in its final, static state.
 */
const ROUTE = "M36 214C92 214 104 170 160 168S238 182 270 148 318 104 352 92";
const LOOP = "7s";
// Route draws 0–3.5 s; marker travels 0.3–4.2 s; arrival 4.2–5 s; hold; fade and restart.
const T_DRAW = "0;0.5;1";
const T_MOVE = "0;0.04;0.6;1";

export function DirectionsArt({ label }: { label: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const routeId = `${uid}-route`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAnimate(!reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    return () => reduce.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !animate) return;
    let onScreen = false;
    let started = false;
    const apply = () => {
      if (onScreen && !document.hidden) {
        if (!started) {
          svg.setCurrentTime(0);
          started = true;
        }
        svg.unpauseAnimations();
      } else svg.pauseAnimations();
    };
    svg.pauseAnimations();
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      apply();
    });
    io.observe(svg);
    document.addEventListener("visibilitychange", apply);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, [animate]);

  const timed = { dur: LOOP, repeatCount: "indefinite" } as const;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 400 260"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-directions-art
      data-animated={animate ? "true" : "false"}
      className="block h-auto w-full overflow-visible"
    >
      <defs>
        <path id={routeId} d={ROUTE} />
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor="#E8BE4F" stopOpacity="0.55" />
          <stop offset="1" stopColor="#E8BE4F" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Simplified street grid (faint, illustrative). */}
      <g stroke="#ffffff" strokeOpacity="0.07" strokeWidth="10">
        <path d="M0 120H400" />
        <path d="M120 0V260" />
        <path d="M250 0C246 80 262 170 300 260" />
        <path d="M0 40C110 52 210 30 400 54" />
      </g>
      <g stroke="#ffffff" strokeOpacity="0.05" strokeWidth="4">
        <path d="M0 176H96M196 220H400M60 0V100M330 150V260" />
      </g>

      {/* Route: soft road + gold dashes, drawn from the start marker. */}
      <g>
        {animate ? <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.9;0.975;1" {...timed} /> : null}
        <use href={`#${routeId}`} stroke="#ffffff" strokeOpacity="0.1" strokeWidth="14" />
        <path
          d={ROUTE}
          stroke="#E8BE4F"
          strokeWidth="3"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={animate ? 1 : 0}
          data-route
        >
          {animate ? <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes={T_DRAW} {...timed} /> : null}
        </path>
        <use href={`#${routeId}`} stroke="#072E1D" strokeWidth="1.2" strokeDasharray="5 7" />

        {/* Start + two waypoints. */}
        <circle cx="36" cy="214" r="9" fill="#072E1D" stroke="#E8BE4F" strokeWidth="2" />
        <circle cx="36" cy="214" r="3.5" fill="#E8BE4F" />
        {[
          [160, 168],
          [270, 148],
        ].map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r="4" fill="#0F5D3A" stroke="#F6DC8F" strokeWidth="1.5" />
        ))}

        {/* Travelling marker with a short trail. */}
        <g data-route-marker>
          {animate ? (
            <animateMotion
              calcMode="spline"
              keyPoints="0;0;1;1"
              keyTimes={T_MOVE}
              keySplines="0 0 1 1;0.45 0 0.4 1;0 0 1 1"
              {...timed}
            >
              <mpath href={`#${routeId}`} />
            </animateMotion>
          ) : (
            <animateMotion keyPoints="1;1" keyTimes="0;1" dur="1s" fill="freeze">
              <mpath href={`#${routeId}`} />
            </animateMotion>
          )}
          <circle r="11" fill={`url(#${uid}-glow)`} />
          <circle r="5.5" fill="#E8BE4F" stroke="#FFF6D8" strokeWidth="1.5" />
        </g>
      </g>

      {/* Destination: Pathirana Hardware — pin with a storefront symbol and a name plate. */}
      <circle cx="352" cy="92" r="16" fill={`url(#${uid}-glow)`} opacity={animate ? 0 : 0.8}>
        {animate ? (
          <animate attributeName="opacity" values="0;0;0.9;0.6;0" keyTimes="0;0.6;0.68;0.9;1" {...timed} />
        ) : null}
      </circle>
      <g data-destination>
        {animate ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 0;0 -9;0 0;0 -3;0 0;0 0"
            keyTimes="0;0.6;0.64;0.68;0.71;0.74;1"
            {...timed}
          />
        ) : null}
        <path
          d="M352 42c-11 0-19 8-19 19 0 15 19 31 19 31s19-16 19-31c0-11-8-19-19-19Z"
          fill="#B8860B"
          stroke="#F6DC8F"
          strokeWidth="1.5"
        />
        {/* Storefront symbol: awning + door. */}
        <path d="M343 56h18l-2 -5h-14Z" fill="#072E1D" />
        <path d="M344 56v11h16V56" stroke="#072E1D" strokeWidth="2" />
        <path d="M350 67v-6h4v6" stroke="#072E1D" strokeWidth="1.6" />
      </g>
      <g>
        <rect x="262" y="104" width="128" height="26" rx="13" fill="#072E1D" stroke="#E8BE4F" strokeOpacity="0.6" />
        <text
          x="326"
          y="121.5"
          textAnchor="middle"
          fill="#F6DC8F"
          fontSize="12"
          fontWeight="600"
          fontFamily="var(--font-sans, system-ui), sans-serif"
        >
          {label}
        </text>
      </g>
    </svg>
  );
}
