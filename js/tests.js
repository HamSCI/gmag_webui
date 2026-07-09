import { assert, assertEquals } from "@std/assert";
import Measurement from "./Measurement.js";
import Vector from "./Vector.js";
import { movingAverage, trailingAverageAt } from "./filter.js";

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
function createJSONL(date, rt, x, y, z) {
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
