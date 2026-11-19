"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CircleCheck, CircleHelp, MapPin, Search } from "lucide-react";
import { whatsappEnquiryHref } from "@/content/business";
import { apiGet, getApiBase, type DeliveryArea, type DeliveryAreaList, type DeliveryCheck } from "@/lib/api";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { HomeEyebrow } from "./HomeEyebrow";

/** loading → fetching areas · ready → areas listed · none → API not configured / unreachable / no areas */
type Load = "loading" | "ready" | "none";
type Result =
  | { kind: "yes"; area: DeliveryArea }
  | { kind: "no"; query: string }
  /** API unavailable or no areas listed: never claims coverage. */
  | { kind: "unconfirmed"; query: string; reason: "offline" | "unlisted" }
  | null;

const areaLabel = (a: DeliveryArea) => (a.district ? `${a.name}, ${a.district}` : a.name);

/**
 * Home › "Do We Deliver to Your Area?"
 *
 * The town search and Check Availability are always shown. With the website
 * API connected, the typed area is checked against the delivery areas staff
 * have approved (no towns are hard-coded). When the API is unavailable, or no
 * areas are listed yet, the answer is an honest "please confirm with our
 * team" — never a claim of coverage. Every result offers a WhatsApp enquiry
 * that names the typed area.
 */
export function DeliveryAreas() {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const configured = getApiBase() !== null;
  const [load, setLoad] = useState<Load>(configured ? "loading" : "none");
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result>(null);

  // Load the approved areas (for suggestions) once the section nears the screen.
  useEffect(() => {
    if (!configured || !root.current) return;
    const ctrl = new AbortController();
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        apiGet<DeliveryAreaList>("/api/v1/delivery-areas", ctrl.signal)
          .then((data) => {
            const items = Array.isArray(data?.items) ? data.items : [];
            setAreas(items);
            setLoad(items.length ? "ready" : "none");
          })
          .catch(() => {
            if (!ctrl.signal.aborted) setLoad("none");
          });
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(root.current);
    return () => {
      io.disconnect();
      ctrl.abort();
    };
  }, [configured]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (!configured) {
      setResult({ kind: "unconfirmed", query: q, reason: "offline" });
      return;
    }
    setChecking(true);
    try {
      const res = await apiGet<DeliveryCheck>(`/api/v1/delivery-areas/check?area=${encodeURIComponent(q)}`);
      if (res.supported && res.area) setResult({ kind: "yes", area: res.area });
      else if (!res.areasListed) setResult({ kind: "unconfirmed", query: q, reason: "unlisted" });
      else setResult({ kind: "no", query: q });
    } catch {
      setResult({ kind: "unconfirmed", query: q, reason: "offline" });
    } finally {
      setChecking(false);
    }
  };

  // The WhatsApp enquiry always names the area the visitor typed (or the matched area).
  const typed = query.trim();
  const askHref = whatsappEnquiryHref(
    result?.kind === "yes"
      ? `delivery to ${areaLabel(result.area)}`
      : `delivery to ${typed || (result ? result.query : "") || "my area"}`,
  );

  return (
    <section
      ref={root}
      aria-labelledby={`${id}-title`}
      data-delivery-state={load}
      className="on-dark relative isolate overflow-hidden bg-forest-900 py-14 text-white lg:py-20"
    >
      <div
        aria-hidden="true"
        className="absolute -right-32 -bottom-40 -z-10 size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(232_190_79/0.14),transparent_65%)]"
      />
      <Container size="wide">
        <InView className="reveal-group grid items-center gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div className="min-w-0 text-center md:text-left">
            <div className="rv md:[&>p]:justify-start">
              <HomeEyebrow tone="dark">Delivery</HomeEyebrow>
            </div>
            <h2
              id={`${id}-title`}
              className="rv d1 mt-4 font-display text-[clamp(1.85rem,6vw,2.6rem)] leading-tight font-semibold"
            >
              Do We Deliver to <span className="text-gold-soft">Your Area?</span>
            </h2>

            <div className="rv d2">
              <p className="mx-auto mt-4 max-w-md leading-relaxed text-sage md:mx-0">
                Type your town or postal code and check — or ask our team to confirm delivery to your site.
              </p>
              <form
                onSubmit={onSubmit}
                className="mx-auto mt-6 grid max-w-lg gap-3 sm:grid-cols-[minmax(0,1fr)_auto] md:mx-0"
              >
                <label htmlFor={`${id}-area`} className="sr-only">
                  Your town, area or postal code
                </label>
                <div className="relative min-w-0">
                  <MapPin
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brass"
                  />
                  <input
                    id={`${id}-area`}
                    type="text"
                    list={areas.length ? `${id}-areas` : undefined}
                    autoComplete="off"
                    enterKeyHint="search"
                    maxLength={80}
                    required
                    placeholder="Your town or postal code"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setResult(null);
                    }}
                    className="h-12 w-full rounded-full border border-white/20 bg-white pr-4 pl-12 text-[0.95rem] text-charcoal outline-none placeholder:text-ink-muted focus:border-gold-soft focus:shadow-[0_0_0_3px_rgb(232_190_79/0.35)]"
                  />
                  {areas.length ? (
                    <datalist id={`${id}-areas`}>
                      {areas.map((a) => (
                        <option key={a.id} value={a.name}>
                          {areaLabel(a)}
                        </option>
                      ))}
                    </datalist>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={checking}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brass px-6 font-semibold whitespace-nowrap text-charcoal transition-colors hover:bg-gold-soft disabled:opacity-70"
                >
                  <Search aria-hidden="true" className="size-4" />
                  {checking ? "Checking…" : "Check Availability"}
                </button>
              </form>

              <div aria-live="polite" className="mx-auto mt-5 max-w-lg md:mx-0">
                {result?.kind === "yes" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-gold-soft/30 bg-white/5 p-4 text-left">
                    <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gold-soft" />
                    <div>
                      <p className="font-semibold">Yes — we deliver to {areaLabel(result.area)}.</p>
                      {result.area.notes ? <p className="mt-1 text-sm text-sage">{result.area.notes}</p> : null}
                      <p className="mt-1 text-sm text-sage">Message us to arrange your delivery.</p>
                    </div>
                  </div>
                ) : result ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-left">
                    <CircleHelp aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gold-soft" />
                    <div>
                      <p className="font-semibold">
                        {result.kind === "no"
                          ? `“${result.query}” is not on our listed delivery areas yet.`
                          : `Please confirm delivery with our team.`}
                      </p>
                      <p className="mt-1 text-sm text-sage">
                        {result.kind === "no"
                          ? "Ask us — we may still be able to help."
                          : `We can’t confirm delivery to “${result.query}” online right now. Send us your location on WhatsApp and we’ll let you know.`}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <a
                href={askHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#177a42] px-6 font-semibold text-white transition-colors hover:bg-[#11653a]"
              >
                <WhatsAppIcon className="size-5" />
                {result?.kind === "yes" ? "Arrange Delivery on WhatsApp" : "Ask About Delivery"}
                <span className="sr-only"> on WhatsApp (opens in a new tab)</span>
              </a>

              {/* Our service areas: the ACTIVE areas staff list (no charges shown). */}
              {areas.length ? (
                <div data-service-areas className="mx-auto mt-7 max-w-lg md:mx-0">
                  <p id={`${id}-areas-title`} className="text-sm font-semibold text-gold-soft">
                    We deliver to
                  </p>
                  <ul
                    aria-labelledby={`${id}-areas-title`}
                    className="mt-2.5 flex flex-wrap justify-center gap-2 md:justify-start"
                  >
                    {areas.map((a) => (
                      <li
                        key={a.id}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 text-sm text-white"
                      >
                        <MapPin aria-hidden="true" className="size-3.5 text-gold-soft" />
                        {a.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rv d2 mx-auto w-full max-w-md">
            <DeliveryArt />
          </div>
        </InView>
      </Container>
    </section>
  );
}

/* ── Animated delivery illustration ─────────────────────────────────────────
   One 8 s loop (SVG SMIL, no libraries):
     0–1 s     the gold dotted route is revealed from the origin;
     1–5.5 s   the truck drives along the same curved path (animateMotion,
               rotate="auto" keeps it aligned), wheels turning;
     5.5–6.5 s it stops; the destination pin bounces and a soft gold pulse glows;
     6.5–8 s   pause, then route and truck fade out and the loop restarts cleanly.
   Paused while off-screen or when the tab is hidden; a still frame (no motion)
   for prefers-reduced-motion and before hydration. Decorative, not a map. */
const ROUTE = "M24 214C96 214 104 150 170 150S246 206 312 182 384 96 398 70";
const LOOP = "8s";
// 0 · 1 s · 5.5 s · end — as fractions of the loop.
const DRIVE_TIMES = "0;0.125;0.6875;1";
const DRIVE_SPLINES = "0 0 1 1;0.45 0 0.55 1;0 0 1 1";
const DRIVE_FROM = 0.07; // truck starts fully inside the frame
const DRIVE_TO = 0.83; // and stops before the pin

function DeliveryArt() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const routeId = `${uid}-route`;
  const maskId = `${uid}-reveal`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAnimate(!reduce.matches);
    sync();
    reduce.addEventListener("change", sync);
    return () => reduce.removeEventListener("change", sync);
  }, []);

  // Run only while visible: pause off-screen / in hidden tabs; start from 0 s.
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
      } else {
        svg.pauseAnimations();
      }
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
      viewBox="0 0 420 260"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-animated={animate ? "true" : "false"}
      className="delivery-art block h-auto w-full overflow-hidden"
    >
      <defs>
        <path id={routeId} d={ROUTE} />
        {/* Reveal mask: a solid stroke along the route, drawn from the origin. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="260">
          <path
            d={ROUTE}
            stroke="#fff"
            strokeWidth="24"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={animate ? 1 : 0}
          >
            {animate ? (
              <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes="0;0.125;1" {...timed} />
            ) : null}
          </path>
        </mask>
      </defs>

      <circle cx="210" cy="130" r="118" stroke="#E8BE4F" strokeOpacity="0.18" />

      {/* Route + truck: fade out at the end of each loop so the restart is seamless. */}
      <g>
        {animate ? <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.92;0.985;1" {...timed} /> : null}
        <g mask={`url(#${maskId})`}>
          <use href={`#${routeId}`} stroke="#ffffff" strokeOpacity="0.1" strokeWidth="16" />
          <use href={`#${routeId}`} stroke="#E8BE4F" strokeWidth="2" strokeDasharray="8 9" />
        </g>
        <circle cx="24" cy="214" r="6" fill="#E8BE4F" />

        {/* Truck (the original artwork, scaled to fit the road). The motion
            origin is the centre of the wheel line, so it rides on the route. */}
        <g>
          {animate ? (
            <animateMotion
              rotate="auto"
              calcMode="spline"
              keyPoints={`${DRIVE_FROM};${DRIVE_FROM};${DRIVE_TO};${DRIVE_TO}`}
              keyTimes={DRIVE_TIMES}
              keySplines={DRIVE_SPLINES}
              {...timed}
            >
              <mpath href={`#${routeId}`} />
            </animateMotion>
          ) : (
            <animateMotion rotate="auto" keyPoints="0.5;0.5" keyTimes="0;1" dur="1s" fill="freeze">
              <mpath href={`#${routeId}`} />
            </animateMotion>
          )}
          <g transform="scale(0.42) translate(-185 -150)" stroke="#F6DC8F" strokeWidth="3">
            <path d="M58 86h26M48 104h30M62 122h18" stroke="#E8BE4F" strokeOpacity="0.6" />
            <rect x="96" y="70" width="118" height="62" rx="6" fill="#0F5D3A" />
            <path d="M214 86h38l22 24v22h-60Z" fill="#0A4A2E" />
            <path d="M222 92h26l14 16h-40Z" fill="#E8BE4F" fillOpacity="0.25" />
            <path d="M110 84h40M110 96h26" stroke="#E8BE4F" strokeOpacity="0.8" />
            {[128, 244].map((cx) => (
              <g key={cx}>
                {animate ? (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    calcMode="spline"
                    values={`0 ${cx} 136;0 ${cx} 136;3780 ${cx} 136;3780 ${cx} 136`}
                    keyTimes={DRIVE_TIMES}
                    keySplines={DRIVE_SPLINES}
                    {...timed}
                  />
                ) : null}
                <circle cx={cx} cy="136" r="13" fill="#072E1D" />
                {/* Spokes make the rotation visible. */}
                <path d={`M${cx - 9} 136h18M${cx} 127v18`} stroke="#B8860B" strokeWidth="2.5" />
                <circle cx={cx} cy="136" r="4" fill="#E8BE4F" stroke="none" />
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* Destination: soft gold pulse + pin bounce when the truck arrives (5.5–6.5 s). */}
      <circle cx="398" cy="93" r="4" fill="#E8BE4F" fillOpacity="0" stroke="#E8BE4F" strokeOpacity="0">
        {animate ? (
          <>
            <animate attributeName="r" values="4;4;26;26" keyTimes="0;0.6875;0.8125;1" {...timed} />
            <animate attributeName="stroke-opacity" values="0;0;0.7;0;0" keyTimes="0;0.6875;0.7;0.8125;1" {...timed} />
            <animate attributeName="fill-opacity" values="0;0;0.25;0;0" keyTimes="0;0.6875;0.7;0.8125;1" {...timed} />
          </>
        ) : null}
      </circle>
      <g>
        {animate ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 0;0 -12;0 0;0 -5;0 0;0 0"
            keyTimes="0;0.6875;0.725;0.76;0.785;0.8125;1"
            {...timed}
          />
        ) : null}
        <path
          d="M398 52c-9 0-15 7-15 15 0 12 15 26 15 26s15-14 15-26c0-8-6-15-15-15Z"
          fill="#B8860B"
          stroke="#F6DC8F"
          strokeWidth="1.5"
        />
        <circle cx="398" cy="67" r="5" fill="#072E1D" />
      </g>
    </svg>
  );
}
