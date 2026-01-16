// ✅ FIXED: no duplicate ScribbleApp declarations.
// Your previous textdoc mixed multiple files into one, so when you pasted it into /index.tsx
// you ended up declaring ScribbleApp twice (import + local definition).
//
// Below is a clean, deployable Next.js App Router project layout.
// Copy each section into its own file path exactly.

// ==============================================
// FILE: app/layout.tsx
// ==============================================
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meditative Scribble Generator",
  description: "Deterministic A4 scribble generator (V1/V2) for poster-ready SVG exports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

// ==============================================
// FILE: app/page.tsx
// ==============================================
import ScribbleApp from "@/components/ScribbleApp";

export default function Page() {
  return <ScribbleApp />;
}

// ==============================================
// FILE: components/ScribbleApp.tsx
// ==============================================
"use client";

import { useMemo, useState } from "react";
import { generatePath, renderV1, renderV2, type RenderV2Opts, type CapStyle } from "@/lib/engine";

export default function ScribbleApp() {
  const [mode, setMode] = useState<"v1" | "v2">("v2");
  const [seed, setSeed] = useState<number>(42);
  const [steps, setSteps] = useState<number>(60000);
  const [baseWidth, setBaseWidth] = useState<number>(6);
  const [layers, setLayers] = useState<number>(18);
  const [showBoundary, setShowBoundary] = useState<boolean>(true);
  const [cap, setCap] = useState<CapStyle>("round");

  const data = useMemo(() => {
    return generatePath({
      seed,
      steps,
      containment: 0.16,
      curl: 0.012,
      inertia: 0.88,
      shape: "ellipse",
      marginMm: 10,
      bleedMm: 0,
      padMm: 8,
      preset: "cotton",
    });
  }, [seed, steps]);

  const svg = useMemo(() => {
    if (!data) return "";

    if (mode === "v1") {
      // strokeW kept simple for now (can wire UI later)
      return renderV1(data.width, data.height, data, 2, cap, showBoundary);
    }

    const opts: RenderV2Opts = {
      seed,
      layers,
      baseW: baseWidth,
      taperAmt: 0.85,
      bulgeAmt: 0.18,
      jitter: 0.55,
      rough: 0.55,
      pressDepth: 0.75,
      fade: 0.12,
      colorMode: "mono",
      blend: "smooth",
      A: "#111111",
      B: "#555555",
      C: "#000000",
      cap,
      p2wOn: true,
      p2wAmt: 0.65,
      breakup: 0.18,
      showBoundary,
    };

    return renderV2(data.width, data.height, data, opts);
  }, [data, mode, seed, layers, baseWidth, showBoundary, cap]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        height: "100vh",
        background: "#f6f6f4",
        color: "#111",
      }}
    >
      <aside style={{ padding: 16, borderRight: "1px solid #ddd", background: "#fff", overflowY: "auto" }}>
        <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Scribble Generator</h1>
        <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
          V1 = single path. V2 = pencil stack. A4 preview is simulated; export stays A4.
        </p>

        <label style={{ fontSize: 12 }}>Render</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="v2">V2 Pencil</option>
          <option value="v1">V1 Single</option>
        </select>

        <div style={{ height: 10 }} />

        <label style={{ fontSize: 12 }}>Cap</label>
        <select
          value={cap}
          onChange={(e) => setCap(e.target.value as CapStyle)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="round">Round</option>
          <option value="square">Square</option>
          <option value="butt">Butt</option>
        </select>

        <div style={{ height: 10 }} />

        <label style={{ fontSize: 12 }}>Seed</label>
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        />

        <div style={{ height: 10 }} />

        <label style={{ fontSize: 12 }}>Steps: {steps.toLocaleString()}</label>
        <input
          type="range"
          min={5000}
          max={140000}
          step={1000}
          value={steps}
          onChange={(e) => setSteps(Number(e.target.value))}
          style={{ width: "100%" }}
        />

        {mode === "v2" && (
          <>
            <div style={{ height: 10 }} />

            <label style={{ fontSize: 12 }}>Base Width: {baseWidth}px</label>
            <input
              type="range"
              min={1}
              max={30}
              step={0.5}
              value={baseWidth}
              onChange={(e) => setBaseWidth(Number(e.target.value))}
              style={{ width: "100%" }}
            />

            <div style={{ height: 10 }} />

            <label style={{ fontSize: 12 }}>Layers: {layers}</label>
            <input
              type="range"
              min={1}
              max={40}
              step={1}
              value={layers}
              onChange={(e) => setLayers(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </>
        )}

        <div style={{ height: 12 }} />

        <button
          onClick={() => setShowBoundary((v) => !v)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", fontWeight: 650 }}
        >
          Boundary: {showBoundary ? "ON" : "OFF"}
        </button>

        <div style={{ height: 10 }} />

        <button
          onClick={() => setSeed(Math.floor(Math.random() * 1e9))}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", fontWeight: 650 }}
        >
          Random Seed
        </button>

        <div style={{ height: 16 }} />

        <button
          onClick={() => downloadSvg(svg, `scribble_${mode}_${seed}.svg`)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", fontWeight: 650 }}
        >
          Export SVG
        </button>

        <p style={{ fontSize: 11, color: "#666", lineHeight: 1.35 }}>
          Note: Preview is scaled to your screen; SVG export stays A4 @ 300dpi (2480×3508 in viewBox).
        </p>
      </aside>

      <main style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 16, overflow: "auto" }}>
        {/* A4 simulator */}
        <div
          style={{
            aspectRatio: "210 / 297",
            height: "calc(100vh - 32px)",
            width: "auto",
            maxWidth: "calc(100vw - 380px)",
            background: "#fff",
            boxShadow: "0 12px 34px rgba(0,0,0,0.12)",
            borderRadius: 16,
            padding: 18,
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            style={{ width: "100%", height: "100%" }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </main>
    </div>
  );
}

function downloadSvg(svgString: string, filename: string) {
  if (!svgString) return;
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ==============================================
// FILE: lib/engine.ts
// ==============================================
// IMPORTANT:
// 1) This file MUST contain the real implementation (ported from your working HTML).
// 2) The stub below compiles and includes tests; replace the internals with your exact functions.
// 3) Keep function signatures stable.

export type CapStyle = "round" | "square" | "butt";
export type ColorMode = "mono" | "tri";
export type BlendMode = "smooth" | "hard" | "noise";

export type Boundary = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  shape: "ellipse" | "circle" | "superellipse" | "blob";
};

export type PathPoint = { x: number; y: number };
export type PathMeta = { u: number; edge: number; pressure: number; curvature: number };

export type PathData = {
  width: number;
  height: number;
  boundary: Boundary;
  path: PathPoint[];
  meta: PathMeta[];
  pxPerMm: number;
  // keep room for other fields you used
  drawable?: { x: number; y: number; w: number; h: number };
};

export type GeneratePathParams = {
  seed: number;
  steps: number;
  containment: number;
  curl: number;
  inertia: number;
  shape: Boundary["shape"];
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

// ---- Minimal, safe stubs (replace with your real engine) ----
export function generatePath(params: GeneratePathParams): PathData {
  // Placeholder simple spiral so the app runs even before you paste the real engine.
  // Replace entirely with the engine you already built in the standalone HTML.
  const { steps, seed } = params;
  const width = 2480;
  const height = 3508;
  const cx = width / 2;
  const cy = height / 2;

  const path: PathPoint[] = [];
  const meta: PathMeta[] = [];
  let t = seed % 1000;
  for (let i = 0; i < steps; i++) {
    const u = i / Math.max(1, steps - 1);
    const a = u * Math.PI * 20 + (t * 0.0003);
    const r = 200 + u * 1200;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.72;
    path.push({ x, y });
    meta.push({ u, edge: 0.2, pressure: 0.6, curvature: 0.1 });
  }

  return {
    width,
    height,
    boundary: { cx, cy, rx: 900, ry: 1300, shape: params.shape },
    path,
    meta,
    pxPerMm: 300 / 25.4,
  };
}

export function renderV1(svgW: number, svgH: number, data: PathData, strokeW: number, cap: CapStyle, showBoundary: boolean) {
  const d = toPath(data.path);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">`,
    `<rect width="100%" height="100%" fill="#fff"/>`,
    `<path d="${d}" fill="none" stroke="#111" stroke-width="${strokeW}" stroke-linecap="${cap}" stroke-linejoin="round"/>`,
    showBoundary
      ? `<g opacity="0.25"><path d="${boundaryPath(data.boundary)}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="8 10"/></g>`
      : "",
    `</svg>`,
  ].join("\n");
}

export function renderV2(svgW: number, svgH: number, data: PathData, opts: RenderV2Opts) {
  // Stub: render as V1 for now; replace with your full V2 pencil stack.
  return renderV1(svgW, svgH, data, Math.max(1, opts.baseW * 0.2), opts.cap, opts.showBoundary);
}

function toPath(pts: PathPoint[]) {
  if (!pts.length) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  return d;
}

function boundaryPath(b: Boundary) {
  const { cx, cy, rx, ry } = b;
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
}

// ==============================================
// FILE: lib/engine.test.ts  (Node built-in test runner)
// Run: node --test
// ==============================================
import test from "node:test";
import assert from "node:assert/strict";

test("generatePath is deterministic for same seed/steps", () => {
  const a = generatePath({
    seed: 123,
    steps: 2000,
    containment: 0.16,
    curl: 0.012,
    inertia: 0.88,
    shape: "ellipse",
    marginMm: 10,
    bleedMm: 0,
    padMm: 8,
    preset: "cotton",
  });
  const b = generatePath({
    seed: 123,
    steps: 2000,
    containment: 0.16,
    curl: 0.012,
    inertia: 0.88,
    shape: "ellipse",
    marginMm: 10,
    bleedMm: 0,
    padMm: 8,
    preset: "cotton",
  });

  assert.equal(a.path.length, 2000);
  assert.equal(b.path.length, 2000);
  assert.deepEqual(a.path[0], b.path[0]);
  assert.deepEqual(a.path[a.path.length - 1], b.path[b.path.length - 1]);
});

test("renderV1 returns an SVG string with viewBox", () => {
  const d = generatePath({
    seed: 1,
    steps: 100,
    containment: 0.16,
    curl: 0.012,
    inertia: 0.88,
    shape: "ellipse",
    marginMm: 10,
    bleedMm: 0,
    padMm: 8,
    preset: "cotton",
  });
  const svg = renderV1(d.width, d.height, d, 2, "round", true);
  assert.ok(svg.includes("<svg"));
  assert.ok(svg.includes("viewBox=\"0 0"));
});

// ==============================================
// EXPECTED BEHAVIOR QUESTION
// ==============================================
// You said: "make the preview show in full size." 
// Do you want FULL SIZE to mean:
// A) fill the available viewport height (A4 simulator), or
// B) 1:1 physical A4 in real-world cm/inches (not reliable across monitors)?
// Reply with A or B.

// ==============================================
// GitHub + Vercel
// ==============================================
// 1) npx create-next-app@latest scribble-generator --ts --eslint
// 2) Copy files above into the correct paths
// 3) git init && git add -A && git commit -m "init" && git push
// 4) Import repo into Vercel and deploy
