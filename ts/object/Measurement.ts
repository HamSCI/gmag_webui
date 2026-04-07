import Vector from "./Vector.ts";

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
     * @param ts an RFC-2822 formatted timestamp
     * @param rt remote temperature
     * @param x x component
     * @param y y component
     * @param z z component
     */
    constructor(ts: string, rt: number, x: number, y: number, z: number) {
        this.#rfc = ts;
        this.#rt = rt;
        this.#xyz = new Vector(x, y, z);
    }


    get rfc(): string {
        return this.#rfc;
    }

    get date(): Date {
        return this.#convertRFC(this.#rfc);
    }

    /**
     * Returns the remote temperature of this Measurement in Celsius.
     * @return the temperature (in Celsius)
     */
    get celsius(): number {
        return this.#rt;
    }

    /**
     * Returns the remote temperature of this Measurement converted to
     * Fahrenheit.
     * @return the temperature in Fahrenheit
     */
    get fahrenheit(): number {
        return (this.celsius * 1.8) + 32;
    }

    /**
     * Returns this Measurement's field vector in XYZ form.
     * @return the XYZ vector
     */
    get XYZ(): Vector {
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
     * @returns the HEZ vector
     */
    get HEZ(): Vector {
        return new Vector(-this.XYZ[2], this.XYZ[1], this.XYZ[0]);
    }

    /**
     * Converts an RFC timestamp to a native Date object.
     * @param ts_str a timestamp string formatted according to
     * RFC-2822 standard
     * @returns a Date object of the corresponding timestamp string
     */
    #convertRFC(ts_str: string): Date {
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
}