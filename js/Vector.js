/**
 * An instance of this class represents a 3-dimensional vector. Some basic
 * operations can be applied to the vector such as finding its magnitude,
 * unit vector, or angular direction.
 */
export default class Vector {
    #array = [];

    /**
     * Constructs a new 3D vector. Omitted arguments are treated as 0.
     * @param {number} x the first component
     * @param {number} y the second component
     * @param {number} z the third component
     */
    constructor(x = 0, y = 0, z = 0) {
        this.#array[0] = x;
        this.#array[1] = y;
        this.#array[2] = z;
    }

    get [0]() {
        return this.#array[0];
    }

    get [1]() {
        return this.#array[1];
    }

    get [2]() {
        return this.#array[2];
    }

    /**
     * Calculates the magnitude of this Vector.
     * @return {number} the magnitude
     */
    get magnitude() {
        return Math.sqrt(this[0]**2 + this[1]**2 + this[2]**2);
    }

    /**
     * Normalizes this Vector to its unit vector and returns the result as a
     * new Vector.
     * @return {Vector} this Vector's unit vector
     */
    normalize() {
        const norms = this.#array.map(c => c / this.magnitude);
        return new Vector(...norms);
    }

    /**
     * Returns the angle of this Vector (in radians).
     * @return {number[]} a 3-element array of the form [x, y, z] where each
     * element is the angle this Vector makes with that particular axis
     */
    get radians() {
        return this.normalize().map(d => Math.acos(d));
    }

    /**
     * Returns the angle vector of this Vector (in euler angles).
     * @return {number[]} a 3-element array of the form [x, y, z] where each
     * element is the angle this Vector makes with that particular axis
     */
    get eulers() {
        return this.radians.map(r => r * (180 / Math.PI));
    }

    *[Symbol.iterator]() {
        for (const c of this.#array) {
            yield c;
        }
    }

    /**
     * Rotates this Vector on the given axis by the given angle and returns a
     * new Vector.
     * @param axis {"x"|"y"|"z"} the axis label to rotate on ("x", "y", "z")
     * @param angle {number} the angle (in radians) to rotate this Vector by
     * @returns {Vector} a new Vector that is rotated
     */
    rotate(axis, angle) {
        const { sin, cos } = Math;
        const [x, y, z] = this;
        let [newX, newY, newZ] = this;
        if (axis === "x") {
            // Rotate by a on the x-axis:
            // x' = x
            // y' = y*cos(a) - z*sin(a)
            // z' = y*sin(a) + z*cos(a)
            newY = (y * cos(angle)) - (z * sin(angle));
            newZ = (y * sin(angle)) + (z * cos(angle));
        } else if (axis === "y") {
            // Rotate by a on the y-axis:
            // x' = x*cos(a) + z*sin(a)
            // y' = y
            // z' =-x*sin(a) + z*cos(a)
            newX = (x * cos(angle)) + (z * sin(angle));
            newZ = (-x * sin(angle)) + (z * cos(angle));
        } else if (axis === "z") {
            // Rotate by a on the z-axis:
            // x' = x*cos(a) - y*sin(a)
            // y' = x*sin(a) + y*cos(a)
            // z' = z
            newX = (x * cos(angle)) - (y * sin(angle));
            newY = (x * sin(angle)) + (y * cos(angle));
        }
        return new Vector(newX, newY, newZ);
    }

    /**
     * Compares this Vector with the passed argument for equality.
     * @param {Vector} vector the Vector object to compare
     * @returns {boolean} `true` if the two vectors' components are equal, else
     * `false`.
     */
    equals(vector) {
        if (this === vector) {
            return true;
        } else if (!(vector instanceof Vector)) {
            return false;
        } else {
            return this[0] === vector[0]
                && this[1] === vector[1]
                && this[2] === vector[2];
        }
    }
}