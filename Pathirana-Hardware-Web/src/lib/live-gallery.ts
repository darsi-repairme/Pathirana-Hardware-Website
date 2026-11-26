"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryImage } from "@/content/gallery";
import { apiGet, getApiBase } from "./api";
import type { LocaleText } from "./live-services";

/** Published photos managed in the Admin (`GET /api/v1/gallery`, staff order). Hidden photos are never listed. */
export type LivePhoto = {
  id: string;
  title: string;
  caption: string | null;
  altText: string;
  collection: string | null;
  width: number;
  height: number;
  url: string;
  thumbUrl: string;
  translations?: LocaleText;
};

const THUMB = 640;
const abs = (base: string, path: string) => (/^https?:\/\//.test(path) ? path : `${base}${path}`);

/** API photo → the gallery grid's image shape (thumbnail in the grid, full size in the lightbox). */
export function toGalleryImage(p: LivePhoto, base: string, text: { alt: string; caption?: string }): GalleryImage {
  const thumb = abs(base, p.thumbUrl);
  const full = abs(base, p.url);
  const thumbW = Math.min(THUMB, p.width);
  return {
    id: `live-${p.id}`,
    alt: text.alt,
    caption: text.caption,
    width: p.width,
    height: p.height,
    src: thumb,
    srcSet: thumbW < p.width ? `${thumb} ${thumbW}w, ${full} ${p.width}w` : `${full} ${p.width}w`,
  };
}

export type LiveGalleryStatus = "static" | "loading" | "live" | "error";

export function useLiveGallery(): {
  photos: LivePhoto[];
  status: LiveGalleryStatus;
  base: string;
  /** Loads the Gallery again (after an error). */
  retry: () => void;
} {
  const base = getApiBase();
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ photos: LivePhoto[]; status: LiveGalleryStatus }>(() => ({
    photos: [],
    status: base ? "loading" : "static",
  }));
  useEffect(() => {
    if (!base) return;
    let active = true;
    apiGet<{ items: LivePhoto[] }>("/api/v1/gallery")
      .then((r) => active && setState({ photos: r.items, status: "live" }))
      .catch(() => active && setState({ photos: [], status: "error" }));
    return () => {
      active = false;
    };
  }, [base, nonce]);
  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: "loading" }));
    setNonce((n) => n + 1);
  }, []);
  return { ...state, base: base ?? "", retry };
}
