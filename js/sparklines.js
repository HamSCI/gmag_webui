import Measurement from "./Measurement.js";

export function buildSparklineTraces(sparklines) {
    const times = sparklines.map(m => m.ts);
    const last = sparklines[sparklines.length - 1];
    return [
        {
            type: "scattergl",
            mode: "lines",
            marker: { color: "#f00" },
            line: { width: 1.5 },
            x: times,
            y: sparklines.map(m => m.HEZ[0]),
            xaxis: "x",
            yaxis: "y",
        },
        {
            type: "scattergl",
            mode: "markers",
            marker: {
                color: "#f00",
                size: 6
            },
            x: [last.ts],
            y: [last.HEZ[0]],
            xaxis: "x",
            yaxis: "y",
        },
        {
            type: "scattergl",
            mode: "lines",
            marker: { color: "#0f0" },
            line: { width: 1.5 },
            x: times,
            y: sparklines.map(m => m.HEZ[1]),
            xaxis: "x2",
            yaxis: "y2",
        },
        {
            type: "scattergl",
            mode: "markers",
            marker: {
                color: "#0f0",
                size: 6
            },
            x: [last.ts],
            y: [last.HEZ[1]],
            xaxis: "x2",
            yaxis: "y2",
        },
        {
            type: "scattergl",
            mode: "lines",
            marker: { color: "#00f" },
            line: { width: 1.5 },
            x: times,
            y: sparklines.map(m => m.HEZ[2]),
            xaxis: "x3",
            yaxis: "y3",
        },
        {
            type: "scattergl",
            mode: "markers",
            marker: {
                color: "#00f",
                size: 6
            },
            x: [last.ts],
            y: [last.HEZ[2]],
            xaxis: "x3",
            yaxis: "y3",
        },
        {
            type: "scattergl",
            mode: "lines",
            marker: { color: "#f0f" },
            line: { width: 1.5 },
            x: times,
            y: sparklines.map(m => m.HEZ.magnitude),
            xaxis: "x4",
            yaxis: "y4",
        },
        {
            type: "scattergl",
            mode: "markers",
            marker: {
                color: "#f0f",
                size: 6
            },
            x: [last.ts],
            y: [last.HEZ.magnitude],
            xaxis: "x4",
            yaxis: "y4",
        },
        {
            type: "scattergl",
            mode: "lines",
            marker: { color: "#ffae00" },
            line: { width: 1.5 },
            x: times,
            y: sparklines.map(m => m.celsius),
            xaxis: "x5",
            yaxis: "y5",
        },
        {
            type: "scattergl",
            mode: "markers",
            marker: {
                color: "#ffae00",
                size: 6
            },
            x: [last.ts],
            y: [last.celsius],
            xaxis: "x5",
            yaxis: "y5",
        },
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