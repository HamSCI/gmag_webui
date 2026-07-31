import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import Measurement from "./object/Measurement.js";
import Vector from "./object/Vector.js";
import { movingAverage, slidingWindowMeans, trailingAverageAt } from "./filter.js";
import { minMaxOfBucket, reduceBucket } from "./sparklines.js";

/**
 * Builds a Measurement at `sec` seconds past 00:00:00 on 01 Jan 2025.
 * @param {number} sec seconds (0-59)
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [rt=0] remote temperature
 */
function m(sec, x, y, z, rt = 0) {
    const ss = String(sec).padStart(2, "0");
    return new Measurement(`01 Jan 2025 00:00:${ss}`, rt, x, y, z);
}

/**
 * @param {string} date
 * @param {number} rt
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string}
 */
function createJSONL(ts, rt, x, y, z) {
    return `{"ts":"${ts}", "rt":${rt.toFixed(2)}, "x":${x.toFixed(3)}, "y":${y.toFixed(3)}, "z":${z.toFixed(3)}}`;
}

Deno.test("a single sample averages to itself", () => {
    const data = [m(0, 3, 4, 5, 10)];
    const r = trailingAverageAt(data, 0, 60);
    assertEquals(r.XYZ[0], 3);
    assertEquals(r.XYZ[1], 4);
    assertEquals(r.XYZ[2], 5);
    assertEquals(r.celsius, 10);
});

Deno.test("averages every sample inside the trailing window", () => {
    const data = [m(0, 0, 0, 0, 0), m(1, 2, 4, 6, 10), m(2, 4, 8, 12, 20)];
    const r = trailingAverageAt(data, 2, 60); // all three within 60s
    assertEquals(r.XYZ[0], 2); // (0 + 2 + 4) / 3
    assertEquals(r.XYZ[1], 4);
    assertEquals(r.XYZ[2], 6);
    assertEquals(r.celsius, 10);
});

Deno.test("excludes samples older than the window", () => {
    const data = [m(0, 100, 0, 0), m(10, 2, 0, 0), m(12, 4, 0, 0)];
    // 5s window ending at t=12 includes only t >= 7 (the t=10 and t=12 samples)
    const r = trailingAverageAt(data, 2, 5);
    assertEquals(r.XYZ[0], 3); // (2 + 4) / 2 — the t=0 spike is excluded
});

Deno.test("a sample isolated by a data gap averages to itself", () => {
    const data = [m(0, 5, 0, 0), m(1, 7, 0, 0), m(40, 9, 0, 0)];
    // 10s window ending at t=40 reaches back to t=30 — only the t=40 sample
    const r = trailingAverageAt(data, 2, 10);
    assertEquals(r.XYZ[0], 9);
});

Deno.test("movingAverage returns one smoothed point per input", () => {
    const data = [m(0, 1, 0, 0), m(1, 3, 0, 0), m(2, 5, 0, 0)];
    const out = movingAverage(data, 60);
    assertEquals(out.length, 3);
    assertEquals(out[0].XYZ[0], 1); // itself
    assertEquals(out[1].XYZ[0], 2); // (1 + 3) / 2
    assertEquals(out[2].XYZ[0], 3); // (1 + 3 + 5) / 3
});


Deno.test("JSONL parsing", () => {
    const jsonl = createJSONL("01 Jan 2026 00:00:00", 28, 1, 2, 3);
    const obj = JSON.parse(jsonl);
    assert("ts" in obj && typeof obj.ts === "string");
    assert("rt" in obj && typeof obj.rt === "number");
    assert("x"  in obj && typeof obj.x  === "number");
    assert("y"  in obj && typeof obj.y  === "number");
    assert("z"  in obj && typeof obj.z  === "number");
});

Deno.test("Unit vector magnitude", () => {
    const v = new Vector(0, 0, 1);
    assertEquals(v.magnitude, 1);
});

Deno.test("Magnitude test 2", () => {
    const v = new Vector(1, 1, 1);
    assertEquals(v.magnitude, Math.sqrt(3));
});

Deno.test("XYZ to HEZ conversion", () => {
    const m = new Measurement("01 Jan 2026 00:00:00", 1, 2, 3, 4);
    const { HEZ } = m;
    assertEquals(HEZ[0], -4);
    assertEquals(HEZ[1],  3);
    assertEquals(HEZ[2],  2);
});

// ----------------------------------------------------------------------------
// Coordinate rotation (Vector.rotate) — the sidebar's Rotation control applies
// this to each reading's HEZ, in degrees (inRad = false). An absolute tolerance
// is used because trig introduces ~1e-16 residue (e.g. cos(90 deg)) and
// assertAlmostEquals' default tolerance collapses to 0 when the expected is 0.
// ----------------------------------------------------------------------------
const TOL = 1e-9;

Deno.test("90-degree rotation about z maps +x to +y", () => {
    const r = new Vector(1, 0, 0).rotate("z", 90, false);
    assertAlmostEquals(r[0], 0, TOL);
    assertAlmostEquals(r[1], 1, TOL);
    assertAlmostEquals(r[2], 0, TOL);
});

Deno.test("90-degree rotation about x maps +y to +z", () => {
    const r = new Vector(0, 1, 0).rotate("x", 90, false);
    assertAlmostEquals(r[0], 0, TOL);
    assertAlmostEquals(r[1], 0, TOL);
    assertAlmostEquals(r[2], 1, TOL);
});

Deno.test("90-degree rotation about y maps +z to +x", () => {
    const r = new Vector(0, 0, 1).rotate("y", 90, false);
    assertAlmostEquals(r[0], 1, TOL);
    assertAlmostEquals(r[1], 0, TOL);
    assertAlmostEquals(r[2], 0, TOL);
});

Deno.test("a full 360-degree rotation returns the original vector", () => {
    const r = new Vector(3, -4, 5).rotate("z", 360, false);
    assertAlmostEquals(r[0], 3, TOL);
    assertAlmostEquals(r[1], -4, TOL);
    assertAlmostEquals(r[2], 5, TOL);
});

Deno.test("rotation defaults to radians", () => {
    const r = new Vector(1, 0, 0).rotate("z", Math.PI / 2);
    assertAlmostEquals(r[0], 0, TOL);
    assertAlmostEquals(r[1], 1, TOL);
});

Deno.test("rotation preserves magnitude", () => {
    const v = new Vector(3, -4, 5);
    const r = v.rotate("y", 37, false);
    assertAlmostEquals(r.magnitude, v.magnitude, TOL);
});

// ----------------------------------------------------------------------------
// delta-B subtraction (Vector.delta) and scaling (Vector.scale)
// ----------------------------------------------------------------------------
Deno.test("delta subtracts a fixed baseline component-wise", () => {
    const r = new Vector(10, 20, 30).delta(1, 2, 3);
    assertEquals(r[0], 9);
    assertEquals(r[1], 18);
    assertEquals(r[2], 27);
});

Deno.test("scale multiplies every component", () => {
    const r = new Vector(1, 2, 3).scale(2);
    assertEquals(r[0], 2);
    assertEquals(r[1], 4);
    assertEquals(r[2], 6);
});

// ----------------------------------------------------------------------------
// Export formatting (Measurement.toJSONL / toCSV) — the Spreadsheet's
// Export JSONL / Export CSV buttons serialize each reading this way.
// ----------------------------------------------------------------------------
Deno.test("toJSONL fixes rt to 2 and x/y/z to 3 decimals", () => {
    const mm = new Measurement("01 Jan 2025 00:00:00", 21.5, 19993.132, -4957.555, 45003.35);
    assertEquals(
        mm.toJSONL(),
        `{"ts":"01 Jan 2025 00:00:00", "rt":21.50, "x":19993.132, "y":-4957.555, "z":45003.350}`);
});

Deno.test("toJSONL output round-trips through JSON.parse", () => {
    const mm = new Measurement("01 Jan 2025 00:00:00", 21.5, 1.25, -2.5, 3.75);
    const obj = JSON.parse(mm.toJSONL());
    assertEquals(obj.ts, "01 Jan 2025 00:00:00");
    assertEquals(obj.rt, 21.5);
    assertEquals(obj.x, 1.25);
    assertEquals(obj.y, -2.5);
    assertEquals(obj.z, 3.75);
});

Deno.test("toCSV quotes the timestamp and fixes the numeric columns", () => {
    const mm = new Measurement("01 Jan 2025 00:00:00", 21.5, 19993.132, -4957.555, 45003.35);
    assertEquals(
        mm.toCSV(),
        `"01 Jan 2025 00:00:00",21.50,19993.132,-4957.555,45003.350`);
});

Deno.test("a Measurement round-trips XYZ through JSONL export and re-parse", () => {
    const original = new Measurement("01 Jan 2025 00:00:00", 22, 1.5, -2.5, 3.5);
    const obj = JSON.parse(original.toJSONL());
    const restored = new Measurement(obj.ts, obj.rt, obj.x, obj.y, obj.z);
    assertEquals(restored.XYZ[0], original.XYZ[0]);
    assertEquals(restored.XYZ[1], original.XYZ[1]);
    assertEquals(restored.XYZ[2], original.XYZ[2]);
});

// ----------------------------------------------------------------------------
// JSON Lines parsing into a Measurement — the path loadLogFile / the live
// transports take for each incoming line.
// ----------------------------------------------------------------------------
Deno.test("a JSONL line parses into a Measurement with the right field/HEZ", () => {
    const line = createJSONL("01 Jan 2025 12:30:45", 22, 1, 2, 3);
    const obj = JSON.parse(line);
    const mm = new Measurement(obj.ts, obj.rt, obj.x, obj.y, obj.z);
    assertEquals(mm.XYZ[0], 1);
    assertEquals(mm.XYZ[1], 2);
    assertEquals(mm.XYZ[2], 3);
    assertEquals(mm.celsius, 22);
    // XYZ -> HEZ: (-z, y, x)
    assertEquals(mm.HEZ[0], -3);
    assertEquals(mm.HEZ[1], 2);
    assertEquals(mm.HEZ[2], 1);
    // The timestamp parses to the expected UTC instant.
    assertEquals(mm.ts.getTime(), Date.UTC(2025, 0, 1, 12, 30, 45));
});

Deno.test("the Measurement constructor rejects mistyped arguments", () => {
    let threw = false;
    try {
        new Measurement("01 Jan 2025 00:00:00", "not-a-number", 1, 2, 3);
    } catch (_e) {
        threw = true;
    }
    assert(threw);
});

// ----------------------------------------------------------------------------
// Data buffer management — sparkline downsampling buckets.
// reduceBucket averages a bucket to one point; minMaxOfBucket yields the
// per-component envelope. Both stamp the result with the bucket's last time.
// ----------------------------------------------------------------------------
Deno.test("reduceBucket averages XYZ and temperature over the bucket", () => {
    const bucket = [m(0, 0, 0, 0, 0), m(1, 2, 4, 6, 10), m(2, 4, 8, 12, 20)];
    const r = reduceBucket(bucket);
    assertEquals(r.XYZ[0], 2);  // (0 + 2 + 4) / 3
    assertEquals(r.XYZ[1], 4);
    assertEquals(r.XYZ[2], 6);
    assertEquals(r.celsius, 10);
    assertEquals(r.rfc, "01 Jan 2025 00:00:02"); // last sample's timestamp
});

Deno.test("minMaxOfBucket returns the per-component envelope", () => {
    const bucket = [m(0, 5, 1, 9, 3), m(1, 2, 8, 4, 7), m(2, 9, 3, 6, 1)];
    const [min, max] = minMaxOfBucket(bucket);
    assertEquals([min.XYZ[0], min.XYZ[1], min.XYZ[2]], [2, 1, 4]);
    assertEquals(min.celsius, 1);
    assertEquals([max.XYZ[0], max.XYZ[1], max.XYZ[2]], [9, 8, 9]);
    assertEquals(max.celsius, 7);
    assertEquals(min.rfc, "01 Jan 2025 00:00:02");
});

// ----------------------------------------------------------------------------
// O(N) sliding-window means (filter.js) — the day-size moving-average path.
// Must match the trailing-window semantics of trailingAverageAt.
// ----------------------------------------------------------------------------
Deno.test("slidingWindowMeans averages every sample inside the window", () => {
    const times = [0, 1000, 2000]; // ms
    const [out] = slidingWindowMeans(times, [[0, 2, 4]], 60);
    assertEquals(out[0], 0); // [0]
    assertEquals(out[1], 1); // (0 + 2) / 2
    assertEquals(out[2], 2); // (0 + 2 + 4) / 3
});

Deno.test("slidingWindowMeans drops samples older than the window", () => {
    const times = [0, 10000, 12000]; // ms
    // 5s window ending at t=12000 reaches back to t=7000 -> excludes t=0.
    const [out] = slidingWindowMeans(times, [[100, 2, 4]], 5);
    assertEquals(out[2], 3); // (2 + 4) / 2
});

Deno.test("slidingWindowMeans matches trailingAverageAt on the same data", () => {
    const data = [m(0, 1, 0, 0), m(20, 3, 0, 0), m(40, 5, 0, 0), m(70, 7, 0, 0)];
    const times = data.map(d => d.ts.getTime());
    const xs = data.map(d => d.XYZ[0]);
    const [fast] = slidingWindowMeans(times, [xs], 60);
    for (let i = 0; i < data.length; i++) {
        assertAlmostEquals(fast[i], trailingAverageAt(data, i, 60).XYZ[0]);
    }
});
