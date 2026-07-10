import Measurement from "./Measurement.js";

/**
 * Builds the Trends sparkline traces: one line plus a current-value marker for
 * each row (H, E, Z, magnitude, temperature).
 *
 * The H/E/Z/magnitude rows are drawn in display space via `toDisplay`, which
 * applies the active source's rotation (and delta-B baseline) exactly like the
 * main plot — so the sparklines mirror what's plotted rather than the raw
 * sensor axes. Temperature is not a field component, so it is shown as-is.
 *
 * @param {Measurement[]} sparklines downsampled measurements, ascending by time
 * @param {(m: Measurement) => import("./Vector.js").default} toDisplay maps a
 *   measurement to its display-space HEZ vector
 */
export function buildSparklineTraces(sparklines, toDisplay) {
    if (sparklines.length === 0) {
        return [];
    }
    const times = sparklines.map(m => m.ts);
    const vecs = sparklines.map(toDisplay);
    const temps = sparklines.map(m => m.celsius);
    const li = sparklines.length - 1;
    const lastTs = times[li];

    // One row = a line over the whole series plus a marker on the latest point.
    const row = (color, ys, xaxis, yaxis) => [
        {
            type: "scattergl",
            mode: "lines",
            marker: { color },
            line: { width: 1.5 },
            x: times,
            y: ys,
            xaxis,
            yaxis,
        },
        {
            type: "scattergl",
            mode: "markers",
            marker: { color, size: 6 },
            x: [lastTs],
            y: [ys[li]],
            xaxis,
            yaxis,
        },
    ];

    return [
        ...row("#f00", vecs.map(v => v[0]), "x", "y"),
        ...row("#0f0", vecs.map(v => v[1]), "x2", "y2"),
        ...row("#0af", vecs.map(v => v[2]), "x3", "y3"),
        ...row("#f0f", vecs.map(v => v.magnitude), "x4", "y4"),
        ...row("#ffae00", temps, "x5", "y5"),
    ];
}

/**
 * Consumes the contents of a Measurement bucket and returns the aggregate
 * result.
 * @param {Measurement[]} bucket
 */
export function reduceBucket(bucket) {
    const bucketTs= bucket[bucket.length - 1].rfc;
    // The Measurement constructor expects the components to be in XYZ, not HEZ
    const bucketX = bucket.reduce((p, c) => p + c.XYZ[0], 0) / bucket.length;
    const bucketY = bucket.reduce((p, c) => p + c.XYZ[1], 0) / bucket.length;
    const bucketZ = bucket.reduce((p, c) => p + c.XYZ[2], 0) / bucket.length;
    const bucketRT = bucket.reduce((p, c) => p + c.celsius, 0) / bucket.length;
    return new Measurement(bucketTs, bucketRT, bucketX, bucketY, bucketZ);
}

/**
 * @param {Measurement[]} bucket
 */
export function minMaxOfBucket(bucket) {
    const bucketTs = bucket[bucket.length - 1].rfc;
    const xMin = Math.min(...bucket.map(m => m.XYZ[0]));
    const yMin = Math.min(...bucket.map(m => m.XYZ[1]));
    const zMin = Math.min(...bucket.map(m => m.XYZ[2]));
    const rtMin = Math.min(...bucket.map(m => m.celsius));

    const xMax = Math.max(...bucket.map(m => m.XYZ[0]));
    const yMax = Math.max(...bucket.map(m => m.XYZ[1]));
    const zMax = Math.max(...bucket.map(m => m.XYZ[2]));
    const rtMax = Math.max(...bucket.map(m => m.celsius));

    return [
        new Measurement(bucketTs, rtMin, xMin, yMin, zMin), // min
        new Measurement(bucketTs, rtMax, xMax, yMax, zMax), // max
    ];
}