import test from "node:test";
import assert from "node:assert/strict";
import { generatePath, renderV1 } from "../lib/engine";

test("generatePath determinism", () => {
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
    preset: "custom",
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
    preset: "custom",
  });
  assert.equal(a.path.length, 2000);
  assert.deepEqual(a.path[0], b.path[0]);
  assert.deepEqual(a.path[a.path.length - 1], b.path[b.path.length - 1]);
});

test("renderV1 produces scalable svg (no fixed width)", () => {
  const d = generatePath({
    seed: 1,
    steps: 200,
    containment: 0.16,
    curl: 0.012,
    inertia: 0.88,
    shape: "ellipse",
    marginMm: 10,
    bleedMm: 0,
    padMm: 8,
    preset: "custom",
  });
  const svg = renderV1(d.width, d.height, d, 2, "round", true);
  assert.ok(svg.includes("preserveAspectRatio=\"xMidYMid meet\""));
  assert.ok(!svg.includes("width=\"620\""));
});
