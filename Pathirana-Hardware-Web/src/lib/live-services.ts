"use client";

import { useCallback, useEffect, useState } from "react";
import { useDynamicText, useT } from "@/i18n/I18nProvider";
import { services as BUNDLED, type Service, type ServiceIcon, type ServiceKind } from "@/content/services";
import { apiGet, getApiBase } from "./api";

/**
 * Services managed in the Admin (API `GET /api/v1/services`, published only, in staff order).
 * The live database is the ONLY source of service content:
 *
 * - While loading: no services (sections show a loading state).
 * - API answered: exactly the published services, with the staff's text, order, translations and
 *   image. A service staff hid disappears; one they added appears.
 * - No API configured, or the API is unreachable: no services ("error" — sections show an
 *   honest "please call / WhatsApp" message). Nothing bundled with the site is ever shown.
 *
 * Only the six approved slugs have pre-built detail pages and 3D scenes (static export); the
 * bundled list is used for those slugs' 3D scene only, never for text. Other services link to
 * their image card on /services/all/ instead of a 404.
 */
export type LocaleText = Partial<Record<"ta" | "si", Partial<Record<string, unknown>>>>;
export type SiteService = Service & {
  translations?: LocaleText;
  image?: { url: string; thumbUrl: string; width: number; height: number; alt: string } | null;
  /** /services/<id>/ exists (bundled slug) — otherwise link to `/services/#<id>`. */
  hasPage: boolean;
};

type ApiService = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  description: string;
  howToAsk: string;
  enquireAbout: string[];
  share: string;
  icon: ServiceIcon;
  kind: ServiceKind;
  translations?: LocaleText;
  image: SiteService["image"];
};

const ICONS: readonly ServiceIcon[] = ["bricks", "truck", "boxes", "bookmark", "lightbulb", "hardhat"];
const KINDS: readonly ServiceKind[] = ["materials", "delivery", "bulk", "reservations", "guidance", "contractor"];
const BUNDLED_IDS = new Set(BUNDLED.map((s) => s.id));
/** The approved 3D scene of each of the six, fixed by slug (a stored `kind` can never swap it). */
const BUNDLED_KIND = new Map(BUNDLED.map((s) => [s.id, s.kind]));
const NONE: readonly SiteService[] = [];

/** API image paths are relative to the API origin. */
const abs = (base: string, path: string) => (/^https?:\/\//.test(path) ? path : `${base}${path}`);

export function toSiteService(a: ApiService, base: string): SiteService {
  return {
    id: a.slug,
    title: a.title,
    shortTitle: a.shortTitle || a.title,
    summary: a.summary,
    description: a.description,
    howToAsk: a.howToAsk,
    enquireAbout: a.enquireAbout ?? [],
    share: a.share,
    icon: ICONS.includes(a.icon) ? a.icon : "bricks",
    kind: BUNDLED_KIND.get(a.slug) ?? (KINDS.includes(a.kind) ? a.kind : "materials"),
    translations: a.translations ?? {},
    image: a.image ? { ...a.image, url: abs(base, a.image.url), thumbUrl: abs(base, a.image.thumbUrl) } : null,
    hasPage: BUNDLED_IDS.has(a.slug),
  };
}

export const serviceHref = (s: Pick<SiteService, "id" | "hasPage">) =>
  s.hasPage ? `/services/${s.id}/` : `/services/all/#${s.id}`;

/** The approved 3D sections (ring, showcase, list) only ever show the six bundled services, by slug. */
export const approvedOnly = <T extends Pick<SiteService, "hasPage">>(list: readonly T[]) =>
  list.filter((s) => s.hasPage);

/** One shared request per minute for every section on the page (same rule as the catalogue). */
let entry: { at: number; promise: Promise<SiteService[]> } | null = null;
function load(): Promise<SiteService[]> {
  if (!entry || Date.now() - entry.at > 60_000) {
    const base = getApiBase()!;
    const promise = apiGet<{ items: ApiService[] }>("/api/v1/services")
      .then((r) => r.items.map((a) => toSiteService(a, base)))
      .catch((e: unknown) => {
        entry = null;
        throw e;
      });
    entry = { at: Date.now(), promise };
  }
  return entry.promise;
}

export type ServicesStatus = "loading" | "live" | "error";

/**
 * `defer: true` postpones the request (e.g. the footer waits until it is scrolled into view, so pages
 * make no API call on load just for the footer); nothing is shown meanwhile.
 */
export function useSiteServices(defer = false): { services: readonly SiteService[]; status: ServicesStatus } {
  const configured = getApiBase() !== null;
  const enabled = configured && !defer;
  const [state, setState] = useState<{ services: readonly SiteService[]; status: ServicesStatus }>(() => ({
    services: NONE,
    status: configured ? "loading" : "error",
  }));
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    load()
      .then((items) => active && setState({ services: items, status: "live" }))
      .catch(() => active && setState({ services: NONE, status: "error" }));
    return () => {
      active = false;
    };
  }, [enabled]);
  return state;
}

/** A service's visitor-facing text in the current language: staff translation, else the site's own, else English. */
export function useServiceText() {
  const pick = useDynamicText();
  const t = useT();
  return useCallback(
    (s: SiteService) => ({
      title: pick(s.title, s.translations, "title"),
      shortTitle: pick(s.shortTitle, s.translations, "shortTitle"),
      summary: pick(s.summary, s.translations, "summary"),
      description: pick(s.description, s.translations, "description"),
      howToAsk: pick(s.howToAsk, s.translations, "howToAsk"),
      share: pick(s.share, s.translations, "share"),
      enquireAbout: s.enquireAbout.map((x) => t(x)),
    }),
    [pick, t],
  );
}
