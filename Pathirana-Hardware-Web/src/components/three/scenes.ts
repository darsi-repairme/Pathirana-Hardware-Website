import type * as ThreeNS from "three";
import type { SceneFactory, SceneHandle, Three } from "./ThreeCanvas";

/* Brand palette (linear-ish hex values used by three.js materials). */
const C = {
  forest: 0x0f5d3a,
  forestDeep: 0x072e1d,
  gold: 0xe8be4f,
  brass: 0xb8860b,
  cream: 0xf8f6ed,
  red: 0xe3101a,
  helmet: 0xf2c230,
  brick: 0xb5532e,
  steel: 0x9aa3ab,
  charcoal: 0x222222,
  card: 0xc8955a,
  bag: 0xd9cfb8,
};

/**
 * Keeps a composition fully in frame on any canvas shape: when the canvas is
 * narrower than `fitAspect` (portrait phones, narrow columns) the camera
 * moves back along its view line so the object is never cropped sideways.
 */
function fitCamera(
  camera: ThreeNS.PerspectiveCamera,
  base: ThreeNS.Vector3,
  target: ThreeNS.Vector3,
  aspect: number,
  fitAspect: number,
) {
  const scale = aspect < fitAspect ? fitAspect / aspect : 1;
  camera.position.copy(base).sub(target).multiplyScalar(scale).add(target);
  camera.lookAt(target);
}

const ease = (current: number, target: number, delta: number, speed = 6) =>
  current + (target - current) * Math.min(1, delta * speed);

/** Soft radial glow texture (drawn once per scene). */
function glowTexture(THREE: Three, rgb: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0.9)`);
  g.addColorStop(0.35, `rgba(${rgb},0.35)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lights(THREE: Three, scene: ThreeNS.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff6e0, 0x0a3a24, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.PointLight(C.gold, 8, 8, 2);
  rim.position.set(-2.2, 1.6, 1.8);
  scene.add(rim);
}

const std = (THREE: Three, color: number, roughness = 0.5, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(THREE: Three, w: number, h: number, d: number, mat: ThreeNS.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/* ───────────────────────── Service objects ───────────────────────── */

type ServiceKind = "materials" | "delivery" | "bulk" | "reservations" | "guidance" | "contractor";

function buildTruck(THREE: Three) {
  const g = new THREE.Group();
  const white = std(THREE, 0xf3f1ea, 0.45);
  const green = std(THREE, C.forest, 0.4, 0.1);
  const gold = std(THREE, C.gold, 0.3, 0.9);
  const dark = std(THREE, C.charcoal, 0.7);
  const glass = std(THREE, 0x1d2b33, 0.15, 0.4);
  g.add(box(THREE, 1.35, 0.78, 0.78, white, -0.25, 0.66, 0));
  g.add(box(THREE, 1.37, 0.06, 0.8, gold, -0.25, 0.42, 0));
  g.add(box(THREE, 0.62, 0.62, 0.74, green, 0.76, 0.56, 0));
  g.add(box(THREE, 0.04, 0.26, 0.6, glass, 1.08, 0.72, 0));
  g.add(box(THREE, 1.95, 0.08, 0.7, dark, 0.05, 0.25, 0));
  const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 28);
  const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.17, 16);
  for (const x of [-0.6, 0.74])
    for (const z of [-0.36, 0.36]) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.2, z);
      const h = new THREE.Mesh(hubGeo, gold);
      h.rotation.x = Math.PI / 2;
      h.position.set(x, 0.2, z);
      g.add(w, h);
    }
  g.scale.setScalar(0.82);
  g.position.x = -0.05;
  return g;
}

function buildClipboard(THREE: Three) {
  const g = new THREE.Group();
  const board = new THREE.Group();
  board.add(box(THREE, 0.95, 1.3, 0.06, std(THREE, 0x8a5a2e, 0.6)));
  board.add(box(THREE, 0.82, 1.1, 0.02, std(THREE, C.cream, 0.8), 0, -0.05, 0.04));
  board.add(box(THREE, 0.38, 0.14, 0.1, std(THREE, C.gold, 0.25, 0.95), 0, 0.62, 0.04));
  const check = std(THREE, C.forest, 0.5);
  const line = std(THREE, 0xb9b3a3, 0.8);
  for (let i = 0; i < 3; i++) {
    const y = 0.3 - i * 0.28;
    board.add(box(THREE, 0.12, 0.12, 0.02, check, -0.26, y, 0.06));
    board.add(box(THREE, 0.4, 0.04, 0.02, line, 0.08, y, 0.06));
  }
  board.position.set(-0.2, 0.78, -0.1);
  board.rotation.x = -0.18;
  const crate = new THREE.Group();
  crate.add(box(THREE, 0.62, 0.48, 0.52, std(THREE, C.card, 0.85)));
  crate.add(box(THREE, 0.64, 0.05, 0.12, std(THREE, 0xe0c08f, 0.7), 0, 0.24, 0));
  crate.position.set(0.48, 0.24, 0.3);
  crate.rotation.y = -0.35;
  g.add(board, crate);
  return g;
}

function buildHelmet(THREE: Three) {
  const g = new THREE.Group();
  const yellow = new THREE.MeshPhysicalMaterial({
    color: C.helmet,
    roughness: 0.28,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), yellow);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.9, 0.05, 48), yellow);
  brim.scale.z = 1.18;
  brim.position.z = 0.1;
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.055, 12, 48, Math.PI), yellow);
  ridge.rotation.y = Math.PI / 2;
  g.add(dome, brim, ridge);

  // The brand mark (symbol only — no text) on the front of the helmet.
  const loader = new THREE.TextureLoader();
  const tex = loader.load("/images/opt/pathirana-logo-mark-256.webp", () => {
    // Redraw once the texture arrives (matters for the reduced-motion still frame).
    let root: ThreeNS.Object3D = g;
    while (root.parent) root = root.parent;
    (root.userData.redraw as (() => void) | undefined)?.();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.345),
    new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  const elev = 0.5;
  mark.position.set(0, Math.sin(elev) * 0.76, Math.cos(elev) * 0.76);
  mark.rotation.x = -elev;
  g.add(mark);
  g.position.y = 0.12;
  g.rotation.y = -0.35;
  return g;
}

function buildMaterials(THREE: Three) {
  const g = new THREE.Group();
  const brick = std(THREE, C.brick, 0.85);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 3 - row; i++)
      g.add(box(THREE, 0.4, 0.19, 0.22, brick, -0.02 + (i - (2 - row) / 2) * 0.43, 0.1 + row * 0.2, -0.2));
  const bag = std(THREE, C.bag, 0.9);
  const b1 = box(THREE, 0.52, 0.2, 0.72, bag, -0.78, 0.1, 0.15);
  const b2 = box(THREE, 0.5, 0.2, 0.7, bag, -0.76, 0.3, 0.13);
  b2.rotation.y = 0.12;
  g.add(b1, b2);
  const steel = new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.3, metalness: 0.75 });
  const pipeGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.25, 24, 1, true);
  const pos: [number, number][] = [
    [0.52, 0.11],
    [0.75, 0.11],
    [0.98, 0.11],
    [0.635, 0.3],
    [0.865, 0.3],
  ];
  for (const [x, y] of pos) {
    const p = new THREE.Mesh(pipeGeo, steel);
    p.rotation.x = Math.PI / 2;
    p.position.set(x - 0.1, y, 0.25);
    g.add(p);
  }
  g.scale.setScalar(0.92);
  return g;
}

/** Bulk orders: a wooden pallet stacked with cement bags, strapped in gold. */
function buildPallet(THREE: Three) {
  const g = new THREE.Group();
  const wood = std(THREE, 0xa8743f, 0.85);
  const woodDark = std(THREE, 0x7d5430, 0.9);
  for (const z of [-0.42, 0, 0.42]) g.add(box(THREE, 1.5, 0.1, 0.14, woodDark, 0, 0.05, z));
  for (let i = 0; i < 7; i++) g.add(box(THREE, 0.18, 0.05, 1.0, wood, -0.63 + i * 0.21, 0.125, 0));
  const bag = std(THREE, C.bag, 0.92);
  const band = std(THREE, C.forest, 0.6);
  const tilt = [0.03, -0.04, 0.02, -0.02, 0.04, -0.03, 0.01, 0.03, -0.02];
  for (let layer = 0; layer < 3; layer++)
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      b.add(box(THREE, 0.44, 0.17, 0.86, bag));
      b.add(box(THREE, 0.445, 0.06, 0.2, band, 0, 0.01, 0));
      b.position.set(-0.47 + i * 0.47 + (layer % 2) * 0.02, 0.24 + layer * 0.18, 0);
      b.rotation.y = tilt[layer * 3 + i]!;
      g.add(b);
    }
  const gold = std(THREE, C.gold, 0.3, 0.9);
  // Two gold straps over the top and down the sides of the stack.
  for (const z of [-0.26, 0.26]) {
    g.add(box(THREE, 1.46, 0.02, 0.05, gold, 0, 0.71, z));
    for (const x of [-0.72, 0.72]) g.add(box(THREE, 0.02, 0.56, 0.05, gold, x, 0.44, z));
  }
  g.scale.setScalar(0.88);
  g.rotation.y = 0.35;
  return g;
}

/** Product advice: a glowing lightbulb (an idea) with a brass screw base. */
function buildBulb(THREE: Three) {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xfff3c4,
    emissive: C.gold,
    emissiveIntensity: 0.55,
    roughness: 0.15,
    transparent: true,
    opacity: 0.88,
    clearcoat: 1,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), glass);
  bulb.position.y = 1.0;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.32, 40, 1, true), glass);
  neck.position.y = 0.6;
  const brass = std(THREE, C.brass, 0.3, 0.95);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 40), brass);
  base.position.y = 0.32;
  g.add(bulb, neck, base);
  for (let i = 0; i < 3; i++) {
    const thread = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.025, 10, 40), brass);
    thread.rotation.x = Math.PI / 2;
    thread.position.y = 0.23 + i * 0.09;
    g.add(thread);
  }
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 24), std(THREE, C.charcoal, 0.6));
  tip.position.y = 0.14;
  g.add(tip);
  const filament = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.018, 8, 32, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
  );
  filament.position.y = 0.95;
  g.add(filament);
  const light = new THREE.PointLight(0xffe2a0, 3, 3, 2);
  light.position.y = 1.0;
  g.add(light);
  g.scale.setScalar(0.85);
  g.position.y = -0.08;
  return g;
}

const builders: Record<ServiceKind, (THREE: Three) => ThreeNS.Group> = {
  materials: buildMaterials,
  delivery: buildTruck,
  bulk: buildPallet,
  reservations: buildClipboard,
  guidance: buildBulb,
  contractor: buildHelmet,
};

/** `spin`: a slow continuous 360° turn (Services page showcase) instead of the gentle sway. */
function serviceScene(kind: ServiceKind, spin = false): SceneFactory {
  return (THREE): SceneHandle => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 50);
    const camBase = new THREE.Vector3(0, 1.25, 4.3);
    const camTarget = new THREE.Vector3(0, 0.5, 0);
    camera.position.copy(camBase);
    camera.lookAt(camTarget);
    lights(THREE, scene);

    // Gold platform ring with a soft glow — echoes the approved design.
    const ringMat = new THREE.MeshStandardMaterial({
      color: C.gold,
      metalness: 1,
      roughness: 0.22,
      emissive: C.brass,
      emissiveIntensity: 0.6,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.035, 12, 96), ringMat);
    ring.rotation.x = -Math.PI / 2;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 64),
      new THREE.MeshStandardMaterial({ color: C.forestDeep, transparent: true, opacity: 0.55, roughness: 0.9 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.005;
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTexture(THREE, "232,190,79"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.5,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.01;
    scene.add(disc, glow, ring);

    // Soft contact shadow under the floating object.
    const shadowMat = new THREE.MeshBasicMaterial({
      map: glowTexture(THREE, "0,0,0"),
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    scene.add(shadow);

    const obj = builders[kind](THREE);
    const holder = new THREE.Group();
    holder.add(obj);
    scene.add(holder);

    const phase = { materials: 0, delivery: 1.05, bulk: 2.1, reservations: 3.15, guidance: 4.2, contractor: 5.25 }[
      kind
    ];
    const s = { lift: 0, rx: 0, ry: 0, glow: 0.5 };
    return {
      scene,
      camera,
      onResize: (aspect) => fitCamera(camera, camBase, camTarget, aspect, 1.75),
      update(t, dt, pointer, hover) {
        s.lift = ease(s.lift, hover ? 0.14 : 0, dt);
        s.ry = ease(s.ry, pointer.x * 0.45, dt, 4);
        s.rx = ease(s.rx, pointer.y * 0.12, dt, 4);
        s.glow = ease(s.glow, hover ? 0.9 : 0.5, dt);
        holder.position.y = 0.12 + Math.sin(t * 1.4 + phase) * 0.06 + s.lift;
        const h = holder.position.y - 0.06;
        shadow.scale.setScalar(1 - h * 0.6);
        shadowMat.opacity = 0.6 - h * 0.9;
        holder.rotation.y = spin ? t * 0.5 + phase : Math.sin(t * 0.45 + phase) * 0.3 + s.ry;
        holder.rotation.x = s.rx;
        glowMat.opacity = s.glow + Math.sin(t * 2 + phase) * 0.06;
        ringMat.emissiveIntensity = 0.5 + s.glow * 0.6;
      },
    };
  };
}

export const materialsScene = serviceScene("materials");
export const deliveryScene = serviceScene("delivery");
export const bulkScene = serviceScene("bulk");
export const reservationsScene = serviceScene("reservations");
export const guidanceScene = serviceScene("guidance");
export const contractorScene = serviceScene("contractor");

/** Same six service scenes with a slow 360° turn (one full turn ≈ 12.5 s). */
export const spinningServiceScenes = {
  materials: serviceScene("materials", true),
  delivery: serviceScene("delivery", true),
  bulk: serviceScene("bulk", true),
  reservations: serviceScene("reservations", true),
  guidance: serviceScene("guidance", true),
  contractor: serviceScene("contractor", true),
} as const;

/* ───────────────────────── Location: 3D map card ───────────────────────── */

/** Stylised, label-free map illustration (decorative — not a real map). */
function mapTexture(THREE: Three) {
  const W = 1024;
  const H = 704;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const r = 56;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, r);
  ctx.clip();
  ctx.fillStyle = "#efe9d8";
  ctx.fillRect(0, 0, W, H);
  // Parks
  ctx.fillStyle = "#b7d3a8";
  for (const [x, y, w, h] of [
    [60, 70, 230, 150],
    [700, 420, 260, 200],
    [380, 520, 170, 120],
    [720, 60, 200, 140],
  ]) {
    ctx.beginPath();
    ctx.roundRect(x!, y!, w!, h!, 40);
    ctx.fill();
  }
  // Water
  ctx.strokeStyle = "#b4d4e2";
  ctx.lineWidth = 46;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-40, 600);
  ctx.bezierCurveTo(200, 520, 260, 700, 420, 760);
  ctx.stroke();
  // Roads
  const road = (pts: number[], width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
    ctx.stroke();
  };
  const minor = [
    [0, 300, 1024, 260],
    [300, 0, 340, 704],
    [640, 0, 600, 704],
    [0, 470, 1024, 520],
    [0, 140, 1024, 170],
    [860, 0, 900, 704],
  ];
  for (const p of minor) road(p, 22, "#d9d1bd");
  for (const p of minor) road(p, 14, "#ffffff");
  road([0, 380, 300, 340, 520, 352, 760, 300, 1024, 330], 30, "#e5c873");
  road([0, 380, 300, 340, 520, 352, 760, 300, 1024, 330], 20, "#f6dc8f");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export const locationScene: SceneFactory = (THREE) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1.5, 0.1, 50);
  const camBase = new THREE.Vector3(0, 3.1, 4.5);
  const camTarget = new THREE.Vector3(0, 0.3, 0);
  camera.position.copy(camBase);
  camera.lookAt(camTarget);
  lights(THREE, scene);

  const card = new THREE.Group();
  const W = 3.4;
  const H = 2.34;
  const shape = new THREE.Shape();
  const rr = 0.18;
  shape.moveTo(-W / 2 + rr, -H / 2);
  shape.lineTo(W / 2 - rr, -H / 2);
  shape.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + rr);
  shape.lineTo(W / 2, H / 2 - rr);
  shape.quadraticCurveTo(W / 2, H / 2, W / 2 - rr, H / 2);
  shape.lineTo(-W / 2 + rr, H / 2);
  shape.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - rr);
  shape.lineTo(-W / 2, -H / 2 + rr);
  shape.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + rr, -H / 2);
  const base = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      bevelSegments: 3,
    }),
    std(THREE, 0xfbf9f2, 0.6),
  );
  base.rotation.x = -Math.PI / 2;
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ map: mapTexture(THREE), transparent: true, roughness: 0.85 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.115;
  card.add(base, top);

  // Glowing gold route leading to the store.
  const route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.45, 0.13, 0.95),
    new THREE.Vector3(-0.9, 0.13, 0.55),
    new THREE.Vector3(-0.35, 0.13, 0.6),
    new THREE.Vector3(-0.15, 0.13, 0.2),
    new THREE.Vector3(0, 0.13, 0),
  ]);
  const routeMesh = new THREE.Mesh(
    new THREE.TubeGeometry(route, 64, 0.025, 8, false),
    new THREE.MeshStandardMaterial({ color: C.forest, emissive: C.forest, emissiveIntensity: 0.4, roughness: 0.4 }),
  );
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff1b8 }),
  );
  const sparkGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({
      map: glowTexture(THREE, "255,214,102"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sparkGlow.rotation.x = -Math.PI / 2;
  card.add(routeMesh, spark, sparkGlow);

  // Ripples under the pin.
  const ripples: ThreeNS.Mesh<ThreeNS.RingGeometry, ThreeNS.MeshBasicMaterial>[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.2, 64),
      new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.125;
    ripples.push(m);
    card.add(m);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshBasicMaterial({ color: 0x072e1d, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.12;
  card.add(shadow);

  // Location pin (brand red).
  const pin = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: C.red, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 24), red);
  head.position.y = 0.62;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 40), red);
  tip.rotation.x = Math.PI;
  tip.position.y = 0.34;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), std(THREE, 0xffffff, 0.3));
  dot.position.set(0, 0.64, 0.22);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.02, 10, 48), std(THREE, C.gold, 0.25, 1));
  halo.position.y = 0.62;
  pin.add(head, tip, dot, halo);
  card.add(pin);

  scene.add(card);

  const s = { rx: 0, ry: 0, hover: 0 };
  return {
    scene,
    camera,
    onResize: (aspect) => fitCamera(camera, camBase, camTarget, aspect, 1.55),
    update(t, dt, pointer, hover) {
      s.ry = ease(s.ry, pointer.x * 0.25, dt, 3);
      s.rx = ease(s.rx, pointer.y * 0.08, dt, 3);
      s.hover = ease(s.hover, hover ? 1 : 0, dt);
      card.rotation.y = -0.18 + Math.sin(t * 0.4) * 0.06 + s.ry;
      card.rotation.x = 0.05 + s.rx;
      card.position.y = Math.sin(t * 0.8) * 0.04;

      const bob = Math.sin(t * 2.1) * 0.07 + s.hover * 0.1;
      pin.position.y = 0.12 + bob;
      pin.rotation.y = t * 0.9;
      shadow.scale.setScalar(1 - bob * 1.2);
      (shadow.material as ThreeNS.MeshBasicMaterial).opacity = 0.28 - bob * 0.6;

      ripples.forEach((m, i) => {
        const p = (t * 0.45 + i / ripples.length) % 1;
        m.scale.setScalar(1 + p * 4.5);
        m.material.opacity = (1 - p) * 0.75;
      });

      const u = Math.min(Math.max((t * 0.22) % 1, 0), 0.999);
      const pt = route.getPointAt(u);
      spark.position.copy(pt);
      sparkGlow.position.set(pt.x, pt.y + 0.005, pt.z);
    },
  };
};
