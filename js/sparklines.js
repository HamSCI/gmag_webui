import Measurement from "./object/Measurement.js";

// Row palette: solid line color + translucent fill for the min/max envelope.
// Order: H, E, Z, magnitude.
const SPARK_ROWS = [
    { color: "#f00", fill: "rgba(255, 0, 0, 0.18)" },
    { color: "#0f0", fill: "rgba(0, 200, 0, 0.16)" },
    { color: "#0af", fill: "rgba(0, 170, 255, 0.18)" },
    { color: "#f0f", fill: "rgba(255, 0, 255, 0.15)" },
];

/**
 * Builds the Trends sparkline traces: for each row (H, E, Z, magnitude) a
 * min/max envelope band, the average line over it, and a marker on the latest
 * point.
 *
 * The rows are drawn in display space via `toDisplay`, which applies the active
 * source's rotation (and delta-B baseline) exactly like the main plot — so the
 * sparklines mirror what's plotted rather than the raw sensor axes.
 *
 * The band comes from each bucket's min/max corner vectors. For H/E/Z this is
 * exact: the app's transforms are signed-axis permutations (90-degree rotations)
 * plus a constant delta-B offset, so each display component is `±(one raw
 * component) + const`, and transforming both corners then taking the per-point
 * componentwise min/max recovers the true display-space range. Magnitude is
 * nonlinear, so its band (from the corner magnitudes) is an approximation of the
 * intra-bucket range — good for the domain's large baseline field with small
 * fluctuations; the band is always widened to enclose the average line.
 *
 * @param {{avg: Measurement, lo: Measurement, hi: Measurement}[]} sparklines
 *   per-bucket aggregates, ascending by time
 * @param {(m: Measurement) => import("./object/Vector.js").default} toDisplay
 * maps a measurement to its display-space HEZ vector
 */
export function buildSparklineTraces(sparklines, toDisplay) {
    if (sparklines.length === 0) {
        return [];
    }
    const times = sparklines.map(s => s.avg.ts);
    const avgV = sparklines.map(s => toDisplay(s.avg));
    const loV = sparklines.map(s => toDisplay(s.lo));
    const hiV = sparklines.map(s => toDisplay(s.hi));
    const li = sparklines.length - 1;
    const lastTs = times[li];

    // For a display value (a component index or the vector magnitude), produce
    // the per-point average / lower / upper arrays. The band is widened to
    // enclose the average so the line never escapes it (only possible for the
    // nonlinear magnitude row; for H/E/Z the average is already within range).
    const series = (pick) => {
        const avg = avgV.map(pick);
        const a = loV.map(pick);
        const b = hiV.map(pick);
        return {
            avg,
            lower: a.map((v, i) => Math.min(v, b[i], avg[i])),
            upper: a.map((v, i) => Math.max(v, b[i], avg[i])),
        };
    };

    // One row = a min/max band (upper line + filled lower line), the average
    // line, and a current-value marker. The band is drawn first so the line
    // sits on top.
    const row = ({ color, fill }, s, xaxis, yaxis) => [
        {
            type: "scatter", mode: "lines", x: times, y: s.upper,
            line: { width: 0 }, hoverinfo: "skip", showlegend: false,
            xaxis, yaxis,
        },
        {
            type: "scatter", mode: "lines", x: times, y: s.lower,
            line: { width: 0 }, fill: "tonexty", fillcolor: fill,
            hoverinfo: "skip", showlegend: false, xaxis, yaxis,
        },
        {
            type: "scatter", mode: "lines", x: times, y: s.avg,
            line: { width: 1.5, color }, xaxis, yaxis,
        },
        {
            type: "scatter", mode: "markers", x: [lastTs], y: [s.avg[li]],
            marker: { color, size: 6 }, xaxis, yaxis,
        },
    ];

    const comp = (c) => series((v) => v[c]);
    const mag = series((v) => v.magnitude);

    return [
        ...row(SPARK_ROWS[0], comp(0), "x", "y"),
        ...row(SPARK_ROWS[1], comp(1), "x2", "y2"),
        ...row(SPARK_ROWS[2], comp(2), "x3", "y3"),
        ...row(SPARK_ROWS[3], mag, "x4", "y4"),
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