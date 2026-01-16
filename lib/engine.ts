/*
  Engine ported from your standalone HTML.
  - Deterministic mulberry32 RNG
  - Boundary confinement (ellipse/circle/superellipse/blob)
  - V1 render (single path)
  - V2 render (micro-stroke pencil stack)

  IMPORTANT DIFFERENCE vs HTML:
  - No window.__showBoundary; boundary is controlled via showBoundary boolean.
*/

export type CapStyle = "round" | "square" | "butt";
export type ColorMode = "mono" | "tri";
export type BlendMode = "smooth" | "hard" | "noise";
export type Shape = "ellipse" | "circle" | "superellipse" | "blob";

export type Boundary = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  shape: Shape;
};

export type PathPoint = { x: number; y: number };
export type PathMeta = { u: number; edge: number; pressure: number; curvature: number };

export type PathData = {
  width: number;
  height: number;
  drawable: { x: number; y: number; w: number; h: number };
  boundary: Boundary;
  path: PathPoint[];
  meta: PathMeta[];
  pxPerMm: number;
};

export type GeneratePathParams = {
  seed: number;
  steps: number;
  containment: number;
  curl: number;
  inertia: number;
  shape: Shape;
  marginMm: number;
  bleedMm: number;
  padMm: number;
  preset: string;
};

export type RenderV2Opts = {
  seed: number;
  layers: number;
  baseW: number;
  taperAmt: number;
  bulgeAmt: number;
  jitter: number;
  rough: number;
  pressDepth: number;
  fade: number;
  colorMode: ColorMode;
  blend: BlendMode;
  A: string;
  B: string;
  C: string;
  cap: CapStyle;
  p2wOn: boolean;
  p2wAmt: number;
  breakup: number;
  showBoundary: boolean;
};

// --- Math / helpers ---
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const hypot2 = (x: number, y: number) => Math.sqrt(x * x + y * y);
const norm2 = (x: number, y: number) => {
  const h = hypot2(x, y) || 1;
  return { x: x / h, y: y / h };
};
const rotate = (v: { x: number; y: number }, a: number) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash1(i: number, s: number) {
  let x = (i ^ s) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const fadeFn = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function valueNoise1D(x: number, s: number) {
  const i0 = Math.floor(x);
  const i1 = i0 + 1;
  const tt = x - i0;
  const a = hash1(i0, s) * 2 - 1;
  const b = hash1(i1, s) * 2 - 1;
  const u = fadeFn(tt);
  return a + (b - a) * u;
}
function fbm1D(x: number, s: number, oct = 4) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * valueNoise1D(x * freq, s + o * 1013);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / (norm || 1);
}

// --- Boundary SDF ---
function ellipseSdfInward(p: PathPoint, cx: number, cy: number, rx: number, ry: number) {
  const ux = (p.x - cx) / rx;
  const uy = (p.y - cy) / ry;
  const r = Math.sqrt(ux * ux + uy * uy) || 1e-9;
  const d = 1 - r; // >0 inside
  const gx = ux / (r * rx);
  const gy = uy / (r * ry);
  const o = norm2(gx, gy);
  return { d, inward: { x: -o.x, y: -o.y } };
}

function superellipseSdfInward(p: PathPoint, cx: number, cy: number, rx: number, ry: number, n: number) {
  const ax = Math.abs((p.x - cx) / rx);
  const ay = Math.abs((p.y - cy) / ry);
  const r = Math.pow(Math.pow(ax, n) + Math.pow(ay, n), 1 / n) || 1e-9;
  const d = 1 - r;
  const sx = p.x - cx >= 0 ? 1 : -1;
  const sy = p.y - cy >= 0 ? 1 : -1;
  const gx = sx * (Math.pow(ax, n - 1) / (rx || 1));
  const gy = sy * (Math.pow(ay, n - 1) / (ry || 1));
  const o = norm2(gx, gy);
  return { d, inward: { x: -o.x, y: -o.y } };
}

function blobSdfInward(p: PathPoint, cx: number, cy: number, rx: number, ry: number, seed: number, t: number) {
  const ang = Math.atan2(p.y - cy, p.x - cx);
  const warp =
    0.16 * fbm1D(ang * 1.2 + t * 0.00002, seed + 777, 4) +
    0.08 * fbm1D(ang * 2.4, seed + 888, 3);
  return ellipseSdfInward(p, cx, cy, rx * (1 + warp), ry * (1 + warp));
}

// --- Path generator ---
export function generatePath(params: GeneratePathParams): PathData {
  let { seed, steps, containment, curl, inertia, shape, marginMm, bleedMm, padMm } = params;

  const baseW = 2480;
  const baseH = 3508;
  const PX_PER_MM = 300 / 25.4;
  const marginPx = (marginMm || 0) * PX_PER_MM;
  const bleedPx = (bleedMm || 0) * PX_PER_MM;
  const padPx = (padMm || 0) * PX_PER_MM;

  const width = baseW + 2 * bleedPx;
  const height = baseH + 2 * bleedPx;

  const drawable = {
    x: bleedPx + marginPx,
    y: bleedPx + marginPx,
    w: width - 2 * (bleedPx + marginPx),
    h: height - 2 * (bleedPx + marginPx),
  };

  const v0 = 1.55;
  const noiseAmp = 0.035;
  const noiseScale = 0.0012;

  const minSide = Math.min(drawable.w, drawable.h);
  let rx = minSide * 0.38;
  let ry = minSide * 0.46;
  if (shape === "circle") {
    const r = minSide * 0.42;
    rx = r;
    ry = r;
  }

  rx = Math.max(40, rx - padPx);
  ry = Math.max(40, ry - padPx);

  const rng = mulberry32(seed);
  const center = { x: drawable.x + drawable.w / 2, y: drawable.y + drawable.h / 2 };

  const startOffset = minSide * 0.14;
  const ang = rng() * Math.PI * 2;
  let p: PathPoint = {
    x: center.x + Math.cos(ang) * startOffset,
    y: center.y + Math.sin(ang) * startOffset,
  };

  let dir = norm2(p.x - center.x, p.y - center.y);
  let prev = { ...dir };

  const path: PathPoint[] = [{ ...p }];
  const meta: PathMeta[] = [{ u: 0, edge: 0, pressure: 0.5, curvature: 0 }];

  for (let t = 1; t < steps; t++) {
    const u = t / (steps - 1);
    const settle = smoothstep(0.12, 0.95, u);

    let sdf;
    if (shape === "superellipse") sdf = superellipseSdfInward(p, center.x, center.y, rx, ry, 6);
    else if (shape === "blob") sdf = blobSdfInward(p, center.x, center.y, rx, ry, seed, t);
    else sdf = ellipseSdfInward(p, center.x, center.y, rx, ry);

    const { d, inward } = sdf;
    const edge = clamp01(1 - d);
    const edge2 = edge * edge;

    const v = lerp(v0 * 1.15, v0 * 0.85, settle);
    const curlT = lerp(curl * 0.8, curl * 1.25, settle);
    const n = fbm1D(t * noiseScale, seed + 303);

    dir = rotate(dir, n * noiseAmp + curlT * (0.55 + 0.9 * edge2));
    dir = norm2(lerp(dir.x, inward.x, containment * edge2), lerp(dir.y, inward.y, containment * edge2));
    dir = norm2(lerp(prev.x, dir.x, 1 - inertia), lerp(prev.y, dir.y, 1 - inertia));

    const dot = clamp01((prev.x * dir.x + prev.y * dir.y + 1) * 0.5);
    const curvature = 1 - dot;

    p = { x: p.x + dir.x * v, y: p.y + dir.y * v };
    path.push({ ...p });

    const baseP = 0.5 + 0.5 * fbm1D(u * 3.0, seed + 900, 4);
    const pressure = clamp01(0.65 * baseP + 0.35 * (1 - curvature));

    meta.push({ u, edge, pressure, curvature });
    prev = { ...dir };
  }

  return {
    width,
    height,
    drawable,
    boundary: { cx: center.x, cy: center.y, rx, ry, shape },
    path,
    meta,
    pxPerMm: PX_PER_MM,
  };
}

// --- SVG helpers ---
export function toPath(pts: PathPoint[]) {
  if (!pts.length) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  return d;
}

export function boundaryPath(b: Boundary) {
  const { cx, cy, rx, ry, shape } = b;
  if (shape === "circle" || shape === "ellipse") {
    return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
  }
  if (shape === "superellipse") {
    const n = 6;
    const pts: PathPoint[] = [];
    const steps = 180;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = cx + rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
      const y = cy + ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
      pts.push({ x, y });
    }
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    return d + " Z";
  }
  // blob: show ellipse guide
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
}

// --- Color mapping ---
function hexToRgb(h: string) {
  const s = h.replace("#", "").trim();
  const v = s.length === 3 ? s.split("").map((ch) => ch + ch).join("") : s;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(rgb: { r: number; g: number; b: number }) {
  const to = (x: number) => x.toString(16).padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}
function mixRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function colorAt(u: number, seed: number, mode: ColorMode, blend: BlendMode, A: string, B: string, C: string) {
  if (mode === "mono") return A;
  const r = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5;
  let t = r;
  if (blend === "noise") {
    const n = 0.5 + 0.5 * fbm1D(u * 4.5, seed + 7777, 3);
    t = clamp01(0.55 * t + 0.45 * n);
  } else if (blend === "hard") {
    t = u < 0.5 ? (u < 0.25 ? 0 : 1) : u < 0.75 ? 0 : 1;
  }
  if (u < 0.5) return rgbToHex(mixRgb(hexToRgb(A), hexToRgb(B), t));
  return rgbToHex(mixRgb(hexToRgb(B), hexToRgb(C), t));
}

// --- V2 Pencil renderer ---
function buildNormals(path: PathPoint[]) {
  const n = path.length;
  const normals = new Array<{ x: number; y: number }>(n);
  for (let i = 0; i < n; i++) {
    const p0 = path[Math.max(0, i - 1)];
    const p1 = path[Math.min(n - 1, i + 1)];
    const t = norm2(p1.x - p0.x, p1.y - p0.y);
    normals[i] = { x: -t.y, y: t.x };
  }
  return normals;
}

function offsetPath(
  path: PathPoint[],
  normals: { x: number; y: number }[],
  meta: PathMeta[],
  seed: number,
  layerIdx: number,
  jitter: number,
  rough: number,
  edgeAvoidPow = 1.6
) {
  const pts = new Array<PathPoint>(path.length);
  const basePhase = seed + 12000 + layerIdx * 97;

  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const n = normals[i];
    const u = meta[i].u;
    const edge = meta[i].edge;

    const edgeAvoid = Math.pow(1 - edge, edgeAvoidPow);
    const j = jitter * edgeAvoid;
    const r = rough * edgeAvoid;

    const nx = fbm1D(u * 10.0 + layerIdx * 0.17, basePhase, 3);
    const ny = fbm1D(u * 10.0 + 9.33 + layerIdx * 0.19, basePhase + 17, 3);

    const offN = j * (0.85 * nx) + r * 0.25 * fbm1D(u * 22.0, basePhase + 333, 2);
    const offT = j * (0.35 * ny);

    const p0 = path[Math.max(0, i - 1)];
    const p1 = path[Math.min(path.length - 1, i + 1)];
    const tdir = norm2(p1.x - p0.x, p1.y - p0.y);

    pts[i] = {
      x: p.x + n.x * offN + tdir.x * offT,
      y: p.y + n.y * offN + tdir.y * offT,
    };
  }

  return pts;
}

function widthAt(u: number, baseW: number, taperAmt: number, bulgeAmt: number) {
  const taperPow = lerp(0.7, 3.2, taperAmt);
  const taper = lerp(1, Math.pow(1 - u, taperPow), taperAmt);

  const pos = 0.48;
  const sig = 0.16;
  const bell = Math.exp(-((u - pos) * (u - pos)) / (2 * sig * sig));
  const bulge = 1 + bulgeAmt * 0.55 * bell;

  return Math.max(0.15, baseW * taper * bulge);
}

function opacityAt(u: number, fade: number, pressure: number, pressDepth: number) {
  const f = fade;
  const fadeIn = smoothstep(0, f, u);
  const fadeOut = 1 - smoothstep(1 - f, 1, u);
  const env = clamp01(Math.min(fadeIn, fadeOut));

  const p = lerp(1, pressure, pressDepth);
  return clamp01(env * (0.12 + 0.88 * p));
}

export function renderV2(svgW: number, svgH: number, data: PathData, opts: RenderV2Opts) {
  const { path, meta, boundary } = data;
  const {
    seed,
    layers,
    baseW,
    taperAmt,
    bulgeAmt,
    jitter,
    rough,
    pressDepth,
    fade,
    colorMode,
    blend,
    A,
    B,
    C,
    cap,
    p2wOn,
    p2wAmt,
    breakup,
    showBoundary,
  } = opts;

  const normals = buildNormals(path);
  const L = Math.max(1, layers);

  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">`);
  svgParts.push(`<rect width="100%" height="100%" fill="#fff"/>`);
  svgParts.push(`<g>`);

  const capStyleVal = cap || "round";
  const joinVal = capStyleVal === "butt" ? "miter" : "round";
  const useSegmentation = (breakup || 0) > 0.001 || !!p2wOn;

  function segmentLayer(pts: PathPoint[], metaArr: PathMeta[], seedSeg: number) {
    const segs: { d: string; u: number; p: number }[] = [];
    const segLen = 46;
    for (let i = 0; i < pts.length - 2; i += segLen) {
      const i2 = Math.min(pts.length - 1, i + segLen);
      const mid = Math.floor((i + i2) * 0.5);
      const uMid = metaArr[mid].u;
      const pMid = metaArr[mid].pressure;
      const nn = 0.5 + 0.5 * fbm1D(uMid * 8.0, seedSeg + 901, 3);
      const lift = (breakup || 0) * (0.65 + 0.35 * nn) * (1 - 0.65 * pMid);
      const keep = hash1(i, seedSeg + 3333) > lift;
      if (!keep) continue;
      let d = `M ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
      for (let k = i + 1; k <= i2; k++) d += ` L ${pts[k].x.toFixed(1)} ${pts[k].y.toFixed(1)}`;
      segs.push({ d, u: uMid, p: pMid });
    }
    return segs;
  }

  // micro layers
  for (let li = 0; li < L; li++) {
    const layerT = L === 1 ? 0.5 : li / (L - 1);
    const centerBias = 1 - Math.abs(layerT - 0.5) * 2;

    const layerJ = jitter * (0.55 + 0.9 * (1 - centerBias));
    const layerR = rough * (0.6 + 0.8 * (1 - centerBias));

    const pts = offsetPath(path, normals, meta, seed, li, layerJ, layerR);
    const layerAlpha = 0.09 + 0.18 * centerBias;

    if (!useSegmentation) {
      const d = toPath(pts);
      const stroke = colorAt(0.5, seed + li * 13, colorMode, blend, A, B, C);
      const w = Math.max(0.12, widthAt(0.45, baseW, taperAmt, bulgeAmt) * (0.14 + 0.06 * centerBias));
      const avgP = 0.65 + 0.35 * fbm1D(li * 0.73, seed + 2200, 3);
      const alpha = clamp01(layerAlpha * opacityAt(0.5, fade, avgP, pressDepth));
      svgParts.push(
        `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w.toFixed(3)}" stroke-linecap="${capStyleVal}" stroke-linejoin="${joinVal}" opacity="${alpha.toFixed(3)}"/>`
      );
    } else {
      const segs = segmentLayer(pts, meta, seed + 7000 + li * 101);
      for (const seg of segs) {
        const pressure = clamp01(0.25 + 0.75 * seg.p);
        const widthP = p2wOn ? lerp(1, pressure, clamp01(p2wAmt || 0)) : 1;
        const w0 = Math.max(0.12, widthAt(seg.u, baseW, taperAmt, bulgeAmt) * (0.14 + 0.06 * centerBias));
        const w = Math.max(0.12, w0 * widthP);
        const alpha = clamp01(layerAlpha * opacityAt(seg.u, fade, pressure, pressDepth));
        const stroke = colorMode === "mono" ? A : colorAt(seg.u, seed + 8000 + li * 13, colorMode, blend, A, B, C);
        svgParts.push(
          `<path d="${seg.d}" fill="none" stroke="${stroke}" stroke-width="${w.toFixed(3)}" stroke-linecap="${capStyleVal}" stroke-linejoin="${joinVal}" opacity="${alpha.toFixed(3)}"/>`
        );
      }
    }
  }

  // spine strokes
  for (let si = 0; si < 3; si++) {
    const w = widthAt(0.5, baseW, taperAmt, bulgeAmt) * (0.55 - si * 0.16);
    const stroke =
      colorMode === "mono" ? A : colorAt(si === 0 ? 0.1 : si === 1 ? 0.5 : 0.9, seed + 999, colorMode, blend, A, B, C);
    const a = 0.42 - si * 0.12;
    svgParts.push(
      `<path d="${toPath(path)}" fill="none" stroke="${stroke}" stroke-width="${Math.max(0.2, w).toFixed(2)}" stroke-linecap="${capStyleVal}" stroke-linejoin="${joinVal}" opacity="${a.toFixed(2)}"/>`
    );
  }

  svgParts.push(`</g>`);

  if (showBoundary) {
    svgParts.push(`<g opacity="0.25">`);
    svgParts.push(
      `<path d="${boundaryPath(boundary)}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="8 10"/>`
    );
    svgParts.push(`</g>`);
  }

  svgParts.push(`</svg>`);
  return svgParts.join("\n");
}

export function renderV1(svgW: number, svgH: number, data: PathData, strokeW: number, cap: CapStyle, showBoundary: boolean) {
  const d = toPath(data.path);
  const join = cap === "butt" ? "miter" : "round";
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">`);
  parts.push(`<rect width="100%" height="100%" fill="#fff"/>`);
  parts.push(
    `<path d="${d}" fill="none" stroke="#111" stroke-width="${strokeW}" stroke-linecap="${cap}" stroke-linejoin="${join}"/>`
  );

  if (showBoundary) {
    parts.push(`<g opacity="0.25">`);
    parts.push(
      `<path d="${boundaryPath(data.boundary)}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="8 10"/>`
    );
    parts.push(`</g>`);
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}
