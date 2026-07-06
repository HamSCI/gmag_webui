import Measurement from "./Measurement.js";

/**
 * Computes a single trailing moving-average Measurement: the mean of every
 * measurement whose timestamp lies within `[endTs - windowSec, endTs]`, where
 * `endTs` is the timestamp of the measurement at `endIdx`.
 *
 * Averaging is performed on the raw XYZ components and the remote temperature.
 * Because the XYZ -> HEZ conversion and the display rotations are all linear,
 * smoothing the XYZ components is equivalent to smoothing the rotated HEZ
 * components, and the magnitude of the averaged vector is the desired filtered
 * magnitude.
 *
 * Data gaps are handled naturally: only samples actually present in the window
 * contribute, so a gap simply yields a smaller window. A window that contains a
 * single sample (e.g. the first reading, or a reading isolated by a gap)
 * returns a value equal to that raw sample.
 *
 * @param {Measurement[]} measurements raw measurements in ascending time order
 * @param {number} endIdx index of the measurement that ends the window
 * @param {number} windowSec trailing window length, in seconds
 * @returns {Measurement} the smoothed measurement at `endIdx`
 */
export function trailingAverageAt(measurements, endIdx, windowSec) {
    const end = measurements[endIdx];
    const startMs = end.ts.getTime() - (windowSec * 1000);

    let sumX = 0, sumY = 0, sumZ = 0, sumRt = 0, count = 0;
    // Walk backwards from endIdx until we fall out of the trailing window.
    // Measurements are time-ordered, so the first out-of-window sample means
    // every earlier sample is out of window too.
    for (let i = endIdx; i >= 0; i--) {
        const m = measurements[i];
        if (m.ts.getTime() < startMs) break;
        sumX += m.XYZ[0];
        sumY += m.XYZ[1];
        sumZ += m.XYZ[2];
        sumRt += m.celsius;
        count++;
    }

    return new Measurement(
        end.rfc,
        sumRt / count,
        sumX / count,
        sumY / count,
        sumZ / count);
}

/**
 * Applies a trailing moving-average filter across an entire measurement series,
 * returning one smoothed Measurement per input measurement.
 * @param {Measurement[]} measurements raw measurements in ascending time order
 * @param {number} windowSec trailing window length, in seconds
 * @returns {Measurement[]} the smoothed series, aligned 1:1 with the input
 */
export function movingAverage(measurements, windowSec) {
    return measurements.map((_, i) =>
        trailingAverageAt(measurements, i, windowSec));
}

/**
 * Trailing moving average of a scalar series aligned 1:1 with `measurements`,
 * using the same time-window semantics as trailingAverageAt. Used for the
 * magnitude overlay, which must smooth the (nonlinear) displayed magnitude
 * directly — averaging the per-sample magnitudes — rather than take the
 * magnitude of the averaged vector (which collapses under delta-B).
 * @param {Measurement[]} measurements ascending by time
 * @param {number[]} values one scalar per measurement
 * @param {number} windowSec trailing window length, in seconds
 * @returns {number[]} trailing means, aligned 1:1 with `measurements`
 */
export function trailingScalarMean(measurements, values, windowSec) {
    return measurements.map((_, end) => {
        const startMs = measurements[end].ts.getTime() - (windowSec * 1000);
        let sum = 0, count = 0;
        for (let i = end; i >= 0; i--) {
            if (measurements[i].ts.getTime() < startMs) break;
            sum += values[i];
            count++;
        }
        return sum / count;
    });
}
