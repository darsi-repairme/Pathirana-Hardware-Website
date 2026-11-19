"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as ThreeNS from "three";

export type Three = typeof ThreeNS;

export type Pointer = { x: number; y: number };

export type SceneHandle = {
  scene: ThreeNS.Scene;
  camera: ThreeNS.PerspectiveCamera;
  /** Called every frame (and once for the static reduced-motion frame). */
  update?: (time: number, delta: number, pointer: Pointer, hover: boolean) => void;
  /** Called on every canvas resize with the new aspect ratio (fit the camera). */
  onResize?: (aspect: number) => void;
};

/** Builds a scene. Must be a stable (module-level) function. */
export type SceneFactory = (THREE: Three) => SceneHandle;

type Props = {
  create: SceneFactory;
  /** Shown until the first WebGL frame is drawn, and whenever WebGL is unavailable. */
  fallback: ReactNode;
  className?: string;
  /** Time used for the single still frame when reduced motion is requested. */
  stillTime?: number;
  /**
   * When false the ambient animation is paused (last frame kept) without
   * tearing the scene down — e.g. services-ring cards turned away from view.
   */
  active?: boolean;
};

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Frees every geometry, material and texture in a scene. */
function disposeScene(scene: ThreeNS.Scene) {
  scene.traverse((obj) => {
    const mesh = obj as ThreeNS.Mesh;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      for (const value of Object.values(m)) {
        if (value && typeof value === "object" && "isTexture" in value) (value as ThreeNS.Texture).dispose();
      }
      m.dispose();
    }
  });
}

/**
 * Small, self-managing Three.js canvas (progressive enhancement).
 *
 * - three.js is imported lazily, only when the canvas nears the viewport.
 * - Rendering pauses while the canvas is off-screen.
 * - Pixel ratio is capped; everything is disposed on unmount.
 * - Reduced motion → one still frame, no animation loop.
 * - No WebGL / context lost → the static fallback stays visible.
 * - Pointer position and hover are read from the closest `[data-three-hover]`
 *   ancestor (e.g. the whole card), so the scene reacts to the card.
 */
export function ThreeCanvas({ create, fallback, className = "", stillTime = 1.2, active = true }: Props) {
  const activeRef = useRef(active);
  const syncRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    activeRef.current = active;
    syncRef.current?.();
  }, [active]);
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglAvailable()) return;

    let disposed = false;
    let cleanup = () => {};

    const start = async () => {
      const THREE = await import("three");
      if (disposed) return;

      let renderer: ThreeNS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return; // keep the fallback
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      const canvas = renderer.domElement;
      canvas.setAttribute("aria-hidden", "true");
      canvas.className = "three-canvas";
      host.appendChild(canvas);

      const handle = create(THREE);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const pointer: Pointer = { x: 0, y: 0 };
      let hover = false;
      let raf = 0;
      let last = performance.now();
      let time = 0;

      const draw = () => renderer.render(handle.scene, handle.camera);
      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        handle.camera.aspect = w / h;
        handle.onResize?.(w / h);
        handle.camera.updateProjectionMatrix();
        if (!raf) draw();
      };

      const frame = (now: number) => {
        const delta = Math.max(0, Math.min((now - last) / 1000, 0.05));
        last = now;
        time += delta;
        handle.update?.(time, delta, pointer, hover);
        draw();
        raf = requestAnimationFrame(frame);
      };

      handle.scene.userData.redraw = () => {
        if (!raf) draw();
      };
      handle.update?.(reduce ? stillTime : 0, 0, pointer, false);
      resize();
      draw();
      setReady(true);

      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const target = (host.closest("[data-three-hover]") as HTMLElement | null) ?? host;
      const onMove = (e: PointerEvent) => {
        const r = target.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      };
      const onEnter = () => (hover = true);
      const onLeave = () => {
        hover = false;
        pointer.x = 0;
        pointer.y = 0;
      };

      let io: IntersectionObserver | null = null;
      if (!reduce) {
        target.addEventListener("pointermove", onMove);
        target.addEventListener("pointerenter", onEnter);
        target.addEventListener("pointerleave", onLeave);
        target.addEventListener("focusin", onEnter);
        target.addEventListener("focusout", onLeave);
        // Ambient animation runs only while the scene is on screen and active.
        let onscreen = false;
        const sync = () => {
          const run = onscreen && activeRef.current;
          if (run && !raf) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
            host.dataset.running = "true";
          } else if (!run && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
            host.dataset.running = "false";
          }
        };
        syncRef.current = sync;
        io = new IntersectionObserver(([entry]) => {
          onscreen = !!entry?.isIntersecting;
          sync();
        });
        io.observe(host);
      }

      const onLost = (e: Event) => {
        e.preventDefault();
        cancelAnimationFrame(raf);
        raf = 0;
        setReady(false);
      };
      canvas.addEventListener("webglcontextlost", onLost);

      cleanup = () => {
        syncRef.current = null;
        cancelAnimationFrame(raf);
        delete host.dataset.running;
        io?.disconnect();
        ro.disconnect();
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerenter", onEnter);
        target.removeEventListener("pointerleave", onLeave);
        target.removeEventListener("focusin", onEnter);
        target.removeEventListener("focusout", onLeave);
        canvas.removeEventListener("webglcontextlost", onLost);
        disposeScene(handle.scene);
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      };
    };

    // Load three.js only when the canvas is close to the viewport.
    const lazy = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          lazy.disconnect();
          void start();
        }
      },
      { rootMargin: "300px 0px" },
    );
    lazy.observe(host);

    return () => {
      disposed = true;
      lazy.disconnect();
      cleanup();
    };
  }, [create, stillTime]);

  return (
    <div ref={hostRef} aria-hidden="true" data-ready={ready ? "" : undefined} className={`three-host ${className}`}>
      <div className="three-fallback">{fallback}</div>
    </div>
  );
}
