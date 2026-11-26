"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ImagePlus, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Alert, Button, Dialog } from "@/components/ui";

const OUTPUT = 512;
const MAX_ZOOM = 4;

type Size = { w: number; h: number };
type View = { zoom: number; x: number; y: number };

/**
 * Square (1:1) crop with a circular avatar preview: drag (mouse, touch or pen) to reposition, the
 * slider / mouse wheel / two-finger pinch to zoom, arrow keys and +/− on the keyboard. The image
 * always covers the crop square (never stretched, no empty edges). Saving draws exactly the framed
 * square into a 512 × 512 WebP (JPEG where the browser cannot encode WebP); phone photos are drawn
 * upright (EXIF orientation applied). No full-size original is uploaded.
 */
export function PhotoCropper({
  file,
  saving,
  error,
  onCancel,
  onChooseAnother,
  onSave,
}: {
  file: File;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onChooseAnother: () => void;
  onSave: (cropped: File) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [stage, setStage] = useState(288);
  const [rawView, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // A preview URL for the chosen file (the parent remounts this dialog for each new file).
  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      u = URL.createObjectURL(file);
      setUrl(u);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [file]);

  // Crop square size: fits the dialog on phones (portrait and landscape) and desktops.
  useEffect(() => {
    const fit = () => {
      const { innerWidth: w, innerHeight: h } = window;
      const shortLandscape = h < 520 && w > h;
      setStage(
        Math.round(
          shortLandscape ? Math.max(120, Math.min(260, h - 232)) : Math.max(180, Math.min(320, w - 112, h * 0.46)),
        ),
      );
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /** Scale at zoom 1: the image's shorter side fills the square. */
  const base = natural ? stage / Math.min(natural.w, natural.h) : 1;
  const clamp = useCallback(
    (v: View): View => {
      if (!natural) return v;
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
      const s = base * zoom;
      const mx = Math.max(0, (natural.w * s - stage) / 2);
      const my = Math.max(0, (natural.h * s - stage) / 2);
      return { zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
    },
    [natural, base, stage],
  );
  /** Always within bounds, also after the crop square resizes (e.g. phone rotated). */
  const view = clamp(rawView);

  const zoomTo = (zoom: number) => setView((v) => clamp({ ...v, zoom }));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: view.zoom };
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      zoomTo((pinch.current.zoom * dist) / Math.max(1, pinch.current.dist));
    } else if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  // Mouse-wheel zoom (a native, non-passive listener so the page does not scroll meanwhile).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      setView((v) => clamp({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clamp]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 30 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key]!;
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomTo(view.zoom + 0.1);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomTo(view.zoom - 0.1);
    }
  };

  const save = async () => {
    if (!natural) return;
    setBusy(true);
    setLocalError(null);
    try {
      // Upright pixels (EXIF orientation applied), same orientation the preview <img> shows.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      // The framed square in the displayed image's pixels, then in the bitmap's pixels (normally 1:1).
      const sN = base * view.zoom;
      const r = bitmap.width / natural.w;
      const side = (stage / sN) * r;
      const sx = (natural.w / 2 - (stage / 2 + view.x) / sN) * r;
      const sy = (natural.h / 2 - (stage / 2 + view.y) / sN) * r;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT, OUTPUT);
      bitmap.close();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
      const out =
        blob && blob.type === "image/webp"
          ? blob
          : await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!out) throw new Error("encode");
      const type = out.type === "image/webp" ? "image/webp" : "image/jpeg";
      onSave(new File([out], type === "image/webp" ? "profile.webp" : "profile.jpg", { type }));
    } catch {
      setLocalError("The cropped photo could not be prepared. Please try another image.");
    } finally {
      setBusy(false);
    }
  };

  const s = base * view.zoom;
  const imgStyle = natural
    ? {
        width: natural.w * s,
        height: natural.h * s,
        transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
      }
    : { opacity: 0 };
  const PREVIEW = 72;
  const k = PREVIEW / stage;

  return (
    <Dialog
      open
      title="Crop profile photo"
      onClose={() => !saving && onCancel()}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={saving || busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving || busy} disabled={!natural} data-crop-save>
            Save Photo
          </Button>
        </>
      }
    >
      {/* Short landscape screens (phones on their side): controls beside the photo, not under it. */}
      <div data-photo-cropper className="space-y-4">
        <p className="text-sm text-ink-muted [@media(max-height:519px)_and_(orientation:landscape)]:hidden">
          Drag to position your photo, and zoom with the slider (or pinch on a phone). The circle shows your avatar.
        </p>
        <div className="flex flex-col items-center gap-4 [@media(max-height:519px)_and_(orientation:landscape)]:flex-row [@media(max-height:519px)_and_(orientation:landscape)]:items-start">
          <div
            ref={stageRef}
            role="group"
            tabIndex={0}
            aria-label="Photo crop area. Use the arrow keys to move the photo, plus and minus to zoom."
            data-crop-stage
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKey}
            className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-2xl bg-charcoal outline-none select-none focus-visible:ring-2 focus-visible:ring-brass active:cursor-grabbing"
            style={{ width: stage, height: stage }}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL)
              <img
                src={url}
                alt="Photo being cropped"
                draggable={false}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                onError={() => setLocalError("This file could not be read as an image.")}
                className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
                style={imgStyle}
              />
            ) : null}
            {/* Circular avatar guide over the square crop. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.45)] ring-2 ring-white/80"
            />
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
            <div className="flex items-center justify-center gap-3 text-xs text-ink-muted">
              <span
                aria-hidden="true"
                data-crop-preview
                className="relative overflow-hidden rounded-full bg-charcoal ring-2 ring-brass"
                style={{ width: PREVIEW, height: PREVIEW }}
              >
                {url && natural ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL)
                  <img
                    src={url}
                    alt=""
                    draggable={false}
                    className="absolute top-1/2 left-1/2 max-w-none"
                    style={{
                      width: natural.w * s * k,
                      height: natural.h * s * k,
                      transform: `translate(calc(-50% + ${view.x * k}px), calc(-50% + ${view.y * k}px))`,
                    }}
                  />
                ) : null}
              </span>
              Preview
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => zoomTo(view.zoom - 0.25)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-forest hover:bg-forest-50"
              >
                <ZoomOut aria-hidden="true" className="size-4" />
                <span className="sr-only">Zoom out</span>
              </button>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={view.zoom}
                onChange={(e) => zoomTo(Number(e.target.value))}
                aria-label="Zoom"
                data-crop-zoom
                className="min-w-0 flex-1 accent-forest"
              />
              <button
                type="button"
                onClick={() => zoomTo(view.zoom + 0.25)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-forest hover:bg-forest-50"
              >
                <ZoomIn aria-hidden="true" className="size-4" />
                <span className="sr-only">Zoom in</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
                icon={<RotateCcw aria-hidden="true" className="size-4" />}
                disabled={saving}
              >
                Reset
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onChooseAnother}
                icon={<ImagePlus aria-hidden="true" className="size-4" />}
                disabled={saving}
              >
                Choose Another Image
              </Button>
            </div>
          </div>
        </div>
        {localError || error ? <Alert>{localError ?? error}</Alert> : null}
      </div>
    </Dialog>
  );
}
