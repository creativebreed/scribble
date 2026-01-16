"use client";

import { useMemo, useState } from "react";
import {
  generatePath,
  renderV1,
  renderV2,
  type CapStyle,
  type RenderV2Opts,
  type Shape,
} from "@/lib/engine";

export default function ScribbleApp() {
  const [mode, setMode] = useState<"v1" | "v2">("v2");
  const [seed, setSeed] = useState<number>(42);
  const [steps, setSteps] = useState<number>(60000);
  const [containment, setContainment] = useState<number>(0.16);
  const [curl, setCurl] = useState<number>(0.012);
  const [inertia, setInertia] = useState<number>(0.88);
  const [shape, setShape] = useState<Shape>("ellipse");
  const [padMm, setPadMm] = useState<number>(8);
  const [marginMm, setMarginMm] = useState<number>(10);
  const [bleedMm, setBleedMm] = useState<number>(0);

  const [v1Stroke, setV1Stroke] = useState<number>(2);

  const [baseWidth, setBaseWidth] = useState<number>(6);
  const [layers, setLayers] = useState<number>(18);
  const [taperAmt, setTaperAmt] = useState<number>(0.85);
  const [bulgeAmt, setBulgeAmt] = useState<number>(0.18);
  const [jitter, setJitter] = useState<number>(0.55);
  const [rough, setRough] = useState<number>(0.55);
  const [pressDepth, setPressDepth] = useState<number>(0.75);
  const [fade, setFade] = useState<number>(0.12);
  const [p2wOn, setP2wOn] = useState<boolean>(true);
  const [p2wAmt, setP2wAmt] = useState<number>(0.65);
  const [breakup, setBreakup] = useState<number>(0.18);

  const [cap, setCap] = useState<CapStyle>("round");
  const [showBoundary, setShowBoundary] = useState<boolean>(true);

  // FULL-SIZE A4 preview (A): fills viewport height.
  const data = useMemo(() => {
    return generatePath({
      seed,
      steps,
      containment,
      curl,
      inertia,
      shape,
      marginMm,
      bleedMm,
      padMm,
      preset: "custom",
    });
  }, [seed, steps, containment, curl, inertia, shape, marginMm, bleedMm, padMm]);

  const svg = useMemo(() => {
    if (!data) return "";
    if (mode === "v1") {
      return renderV1(data.width, data.height, data, v1Stroke, cap, showBoundary);
    }

    // Safety rule: base width up to 100px only if steps < 20000
    const maxW = steps < 20000 ? 100 : 30;
    const safeBaseW = Math.min(baseWidth, maxW);

    const opts: RenderV2Opts = {
      seed,
      layers,
      baseW: safeBaseW,
      taperAmt,
      bulgeAmt,
      jitter,
      rough,
      pressDepth,
      fade,
      colorMode: "mono",
      blend: "smooth",
      A: "#111111",
      B: "#555555",
      C: "#000000",
      cap,
      p2wOn,
      p2wAmt,
      breakup,
      showBoundary,
    };

    return renderV2(data.width, data.height, data, opts);
  }, [
    data,
    mode,
    seed,
    steps,
    layers,
    baseWidth,
    taperAmt,
    bulgeAmt,
    jitter,
    rough,
    pressDepth,
    fade,
    p2wOn,
    p2wAmt,
    breakup,
    v1Stroke,
    cap,
    showBoundary,
  ]);

  const maxBaseW = steps < 20000 ? 100 : 30;
  const clampedBaseW = Math.min(baseWidth, maxBaseW);
  const baseWWarning = baseWidth !== clampedBaseW;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          padding: 16,
          borderRight: "1px solid #ddd",
          background: "#fff",
          overflowY: "auto",
        }}
      >
        <h1 style={{ fontSize: 18, margin: "0 0 8px", fontWeight: 700 }}>
          Scribble Generator
        </h1>
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 12px" }}>
          Preview mode A: A4 fills viewport height. Export is SVG (A4 viewBox).
        </p>

        <Section title="Renderer">
          <Row>
            <Control>
              <Label>Mode</Label>
              <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="v2">V2 Pencil</option>
                <option value="v1">V1 Single</option>
              </select>
            </Control>
          </Row>

          <Row>
            <Control>
              <Label>Cap</Label>
              <select value={cap} onChange={(e) => setCap(e.target.value as CapStyle)}>
                <option value="round">Round</option>
                <option value="square">Square</option>
                <option value="butt">Butt</option>
              </select>
            </Control>
          </Row>

          <Row>
            <Btn onClick={() => setShowBoundary((v) => !v)}>
              Boundary: {showBoundary ? "ON" : "OFF"}
            </Btn>
            <Btn onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
              Random Seed
            </Btn>
          </Row>
        </Section>

        <Section title="Core Path">
          <Control>
            <Label>Seed</Label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
            />
          </Control>

          <Control>
            <Label>Steps: {steps.toLocaleString()}</Label>
            <input
              type="range"
              min={5000}
              max={140000}
              step={1000}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
            />
          </Control>

          <Control>
            <Label>Containment: {containment.toFixed(2)}</Label>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={containment}
              onChange={(e) => setContainment(Number(e.target.value))}
            />
          </Control>

          <Control>
            <Label>Curl: {curl.toFixed(3)}</Label>
            <input
              type="range"
              min={0}
              max={0.08}
              step={0.001}
              value={curl}
              onChange={(e) => setCurl(Number(e.target.value))}
            />
          </Control>

          <Control>
            <Label>Inertia: {inertia.toFixed(3)}</Label>
            <input
              type="range"
              min={0.7}
              max={0.985}
              step={0.005}
              value={inertia}
              onChange={(e) => setInertia(Number(e.target.value))}
            />
          </Control>
        </Section>

        <Section title="Boundary & Print">
          <Control>
            <Label>Shape</Label>
            <select value={shape} onChange={(e) => setShape(e.target.value as Shape)}>
              <option value="ellipse">Ellipse</option>
              <option value="circle">Circle</option>
              <option value="superellipse">Superellipse</option>
              <option value="blob">Organic Blob</option>
            </select>
          </Control>

          <Control>
            <Label>Inner Padding (mm): {padMm}</Label>
            <input
              type="range"
              min={0}
              max={25}
              step={1}
              value={padMm}
              onChange={(e) => setPadMm(Number(e.target.value))}
            />
          </Control>

          <Control>
            <Label>Margins (mm): {marginMm}</Label>
            <input
              type="range"
              min={0}
              max={25}
              step={1}
              value={marginMm}
              onChange={(e) => setMarginMm(Number(e.target.value))}
            />
          </Control>

          <Control>
            <Label>Bleed (mm): {bleedMm}</Label>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={bleedMm}
              onChange={(e) => setBleedMm(Number(e.target.value))}
            />
          </Control>
        </Section>

        {mode === "v1" ? (
          <Section title="V1">
            <Control>
              <Label>Line Thickness (px): {v1Stroke.toFixed(1)}</Label>
              <input
                type="range"
                min={1}
                max={30}
                step={0.5}
                value={v1Stroke}
                onChange={(e) => setV1Stroke(Number(e.target.value))}
              />
            </Control>
          </Section>
        ) : (
          <Section title="V2 Pencil">
            <Control>
              <Label>
                Base Width (px): {clampedBaseW.toFixed(1)}
                {baseWWarning ? " (clamped)" : ""}
              </Label>
              <input
                type="range"
                min={1}
                max={maxBaseW}
                step={0.5}
                value={clampedBaseW}
                onChange={(e) => setBaseWidth(Number(e.target.value))}
              />
              {baseWWarning && (
                <Hint>
                  Base Width &gt; 30px requires Steps &lt; 20000. Reduce Steps or
                  width will clamp.
                </Hint>
              )}
            </Control>

            <Control>
              <Label>Layers: {layers}</Label>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={layers}
                onChange={(e) => setLayers(Number(e.target.value))}
              />
            </Control>

            <Control>
              <Label>Taper: {taperAmt.toFixed(2)}</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={taperAmt}
                onChange={(e) => setTaperAmt(Number(e.target.value))}
              />
            </Control>

            <Control>
              <Label>Bulge +/-: {bulgeAmt.toFixed(2)}</Label>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={bulgeAmt}
                onChange={(e) => setBulgeAmt(Number(e.target.value))}
              />
            </Control>

            <Control>
              <Label>Jitter: {jitter.toFixed(2)}</Label>
              <input
                type="range"
                min={0}
                max={3}
                step={0.01}
                value={jitter}
                onChange={(e) => setJitter(Number(e.target.value))}
              />
            </Control>

            <Control>
              <Label>Roughness: {rough.toFixed(2)}</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={rough}
                onChange={(e) => setRough(Number(e.target.value))}
              />
            </Control>

            <Control>
              <Label>Pressure Depth: {pressDepth.toFixed(2)}</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={pressDepth}
                onChange={(e) => setPressDepth(Number(e.target.value))}
              />
            </Control>

            <Control>
              <Label>Fade In/Out: {fade.toFixed(2)}</Label>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={fade}
                onChange={(e) => setFade(Number(e.target.value))}
              />
            </Control>

            <Control>
              <Label>Pressure → Width</Label>
              <select value={p2wOn ? "on" : "off"} onChange={(e) => setP2wOn(e.target.value === "on")}>
                <option value="off">Off</option>
                <option value="on">On</option>
              </select>
            </Control>

            {p2wOn && (
              <Control>
                <Label>Coupling Amount: {p2wAmt.toFixed(2)}</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={p2wAmt}
                  onChange={(e) => setP2wAmt(Number(e.target.value))}
                />
              </Control>
            )}

            <Control>
              <Label>Stroke Breakup: {breakup.toFixed(2)}</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={breakup}
                onChange={(e) => setBreakup(Number(e.target.value))}
              />
              <Hint>Higher breakup = more micro-gaps (pencil lift / paper skip).</Hint>
            </Control>
          </Section>
        )}

        <Section title="Export">
          <Row>
            <Btn onClick={() => downloadSvg(svg, `scribble_${mode}_${seed}.svg`)}>
              Export SVG
            </Btn>
          </Row>
        </Section>
      </aside>

      <main
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
          overflow: "auto",
        }}
      >
        <div
          className="paper"
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
            alignItems: "stretch",
            justifyContent: "stretch",
          }}
        >
          <div
            className="svgWrap"
            style={{ width: "100%", height: "100%" }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        {/* Force svg sizing so it never collapses into a "dot" */}
        <style jsx global>{`
          .paper svg {
            width: 100% !important;
            height: 100% !important;
            display: block;
          }
        `}</style>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: "14px 0 10px", paddingTop: 12, borderTop: "1px solid #ddd" }}>
      <div style={{ fontSize: 12, color: "#222", letterSpacing: "0.02em", textTransform: "uppercase", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10 }}>{children}</div>;
}

function Control({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 12, width: "100%" }}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "#666", marginTop: 6, lineHeight: 1.35 }}>{children}</div>;
}

function Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: 10,
        border: "1px solid #ddd",
        background: "#fff",
        fontWeight: 700,
        cursor: "pointer",
        borderRadius: 10,
      }}
    >
      {children}
    </button>
  );
}
