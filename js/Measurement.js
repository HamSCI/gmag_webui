import Vector from "./Vector.js";

/**
 * An instance of this class represents a measurement reading from a TAPR
 * ground magnetometer. A measurement contains an XYZ field, a remote
 * temperature (in Celsius), and a logging timestamp. All properties of an
 * instance are read-only after initialization.
 *
 * The XYZ field is treated as a 3-dimensional vector and can have various
 * vector operations applied to it or its components.
 */
export default class Measurement {
    #rfc; #xyz; #rt;

    /**
     * Constructs a new Measurement.
     * @param {string} ts an RFC-2822 formatted timestamp
     * @param {number} rt remote temperature
     * @param {number} x  x component
     * @param {number} y  y component
     * @param {number} z  z component
     */
    constructor(ts, rt, x, y, z) {
        if (!this.#validateArgs(ts, rt, x, y, z)) {
            throw new TypeError("Constructor args are incorrectly typed,");
        }
        this.#rfc = ts;
        this.#rt = rt;
        this.#xyz = new Vector(x, y, z);
    }

    /**
     * Returns a Date object corresponding to this Measurement's RFC timestamp.
     * @returns {Date} the Date object corresponding to this Measurement
     */
    get ts() {
        return this.#convertRFC(this.rfc);
    }

    /**
     * Returns the original RFC-2822 formatted timestamp of when this
     * Measurement was taken.
     * @returns {string} the RFC-2822 timestamp
     */
    get rfc() {
        return this.#rfc;
    }

    /**
     * Returns the remote temperature of this Measurement in Celsius.
     * @returns {number} the remote temperature (in Celsius)
     */
    get celsius() {
        return this.#rt;
    }

    /**
     * Returns the remote temperature of this Measurement converted to
     * Fahrenheit.
     * @returns {number} the remote temperature in Fahrenheit
     */
    get fahrenheit() {
        return (this.celsius * 1.8) + 32;
    }

    /**
     * Returns this Measurement's field vector in XYZ form.
     * @returns {Vector} the XYZ vector
     */
    get XYZ() {
        return this.#xyz;
    }

    /**
     * Converts the field of this Measurement from XYZ to HEZ.
     * The specific conversions for the field are as follows:
     * * Z*(-1) &rarr; H
     * * Y &rarr; E
     * * X &rarr; Z
     *
     * And are returned as a new Vector.
     * @returns {Vector} the HEZ vector
     */
    get HEZ() {
        return new Vector(-this.XYZ[2], this.XYZ[1], this.XYZ[0]);
    }

    /**
     * Scales this Measurement to a factor of k. This method mutates the value
     * of `this`.
     * @param {number} k the scale factor
     */
    setScale(k) {
        this.#xyz = this.#xyz.scale(k);
    }

    /**
     * Denoises a Measurement according to a smoothing constant and a previous
     * data point.
     * @param {number} alpha the smoothing constant
     * @param {Measurement} prev the previous data point
     * @returns {Measurement} the resultant Measurement
     */
    smooth(alpha, prev) {
        /**
         * @param {number} t the raw value
         * @param {number} t0 the smoothed value of the previous data point
         * @returns {number} the smoothed value of t
         */
        const smoothFn = (t, t0) => alpha * t + (1 - alpha) * t0;
        return new Vector(
            smoothFn(this[0], prev[0]),
            smoothFn(this[1], prev[1]),
            smoothFn(this[2], prev[2]));
    }

    toJSONL() {
        const { rfc: ts, celsius: rt, XYZ: [x, y, z] } = this;
        return `{"ts":"${ts}", "rt":${rt.toFixed(2)}, "x":${x.toFixed(3)}, "y":${y.toFixed(3)}, "z":${z.toFixed(3)}}`;
    }

    toCSV() {
        const { rfc: ts, celsius: rt, XYZ: [x, y, z] } = this;
        return `"${ts}",${rt.toFixed(2)},${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    }

    /**
     * Converts an RFC timestamp to a native Date object.
     * @param {string} ts_str a timestamp string formatted according to
     * RFC-2822 standard
     * @returns {Date} a Date object of the corresponding timestamp string
     */
    #convertRFC(ts_str) {
        const [day, monName, year, time] = ts_str.split(" ");
        const month = monName === "Jan" ? "01"
            : monName === "Feb" ? "02"
            : monName === "Mar" ? "03"
            : monName === "Apr" ? "04"
            : monName === "May" ? "05"
            : monName === "Jun" ? "06"
            : monName === "Jul" ? "07"
            : monName === "Aug" ? "08"
            : monName === "Sep" ? "09"
            : monName === "Oct" ? "10"
            : monName === "Nov" ? "11"
            : "12"; // monName === "Dec"
        const timeStr = `${year}-${month}-${day}T${time}.000Z`;
        return new Date(timeStr);
    }

    #validateArgs(ts, rt, x, y, z) {
        return typeof ts === "string"
            && typeof rt === "number"
            && typeof x === "number"
            && typeof y === "number"
            && typeof z === "number";
    }
}