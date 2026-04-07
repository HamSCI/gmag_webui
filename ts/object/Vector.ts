/**
 * An instance of this class represents a 3-dimensional vector. Some basic
 * operations can be applied to the vector such as finding its magnitude,
 * unit vector, or angular direction.
 *
 * All components of a vector are readonly after initialization.
 */
export default class Vector {
    #array: number[] = [];

    /**
     * Constructs a new 3D vector. Omitted arguments are treated as 0.
     * @param x the first component
     * @param y the second component
     * @param z the third component
     */
    constructor(x = 0, y = 0, z = 0) {
        this.#array[0] = x;
        this.#array[1] = y;
        this.#array[2] = z;
    }

    get [0](): number {
        return this.#array[0];
    }
    get [1](): number {
        return this.#array[1];
    }
    get [2](): number {
        return this.#array[2];
    }

    /**
     * Returns an iterator for this Vector.
     */
    *[Symbol.iterator](): Generator<number, void, unknown> {
        for (const c of this.#array) {
            yield c;
        }
    }

    /**
     * Calculates the magnitude of this Vector.
     *
     * The magnitude is calculated by the formula:
     * > ||V|| = sqrt(x^2 + y^2 + z^2)
     *
     * @return the magnitude of this Vector
     */
    get magnitude(): number {
        return Math.sqrt(this[0]**2 + this[1]**2 + this[2]**2);
    }

    /**
     * Normalizes this Vector to its unit vector and returns the result as a
     * new Vector.
     *
     * The unit vector is calculated by dividing each component of the vector
     * by the vector's magnitude.
     * > U = <x/||V||, y/||V||, z/||V||>
     * @return this Vector's unit vector
     */
    normalize(): Vector {
        const norms = this.#array.map(c => c / this.magnitude);
        return new Vector(...norms);
    }

    /**
     * Returns the angle of this Vector (in radians).
     * @return a 3-element array of the form [x, y, z] where each
     * element is the angle this Vector makes with that particular axis
     */
    get radians(): number[] {
        return this.normalize().#array.map(d => Math.acos(d));
    }

    /**
     * Returns the angle vector of this Vector (in euler angles).
     * @return a 3-element array of the form [x, y, z] where each
     * element is the angle this Vector makes with that particular axis
     */
    get eulers(): number[] {
        return this.radians.map(r => r * (180 / Math.PI));
    }

    /**
     * Rotates this Vector on the given axis by the given angle and returns a
     * new Vector.
     * @param axis the axis label to rotate on ("x", "y", "z")
     * @param angle the angle (in radians) to rotate this Vector by
     * @returns a new Vector that is rotated
     */
    rotate(axis: Axis, angle: number): Vector {
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
            newZ =(-x * sin(angle)) + (z * cos(angle));
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
}

type Axis = "x" | "y" | "z";