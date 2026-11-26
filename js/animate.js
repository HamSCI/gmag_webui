/**
 * Animated axis-range changes for the main plot.
 *
 * Plotly's own transitions (Plotly.animate / layout.transition) don't tween
 * WebGL (scattergl) subplots: the range barely moves and then jumps. So the
 * dashboard drives the animation itself, relayouting the axis ranges once per
 * frame. That costs about the same as an interactive drag-pan (~15 ms/frame,
 * independent of point count, since the data isn't re-uploaded).
 *
 * The pure helpers here (easing, interpolation, Plotly-style autorange) are
 * unit-tested in js/tests.js; the frame loop is exercised in the browser.
 */

/**
 * Cubic ease-in-out: starts and ends gently.
 * @param {number} t progress in [0, 1]
 * @returns {number} eased progress in [0, 1]
 */
export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Linearly interpolates both ends of a range.
 * @param {[number, number]} from
 * @param {[number, number]} to
 * @param {number} p progress in [0, 1]
 * @returns {[number, number]}
 */
export function lerpRange(from, to, p) {
    return [
        from[0] + (to[0] - from[0]) * p,
        from[1] + (to[1] - from[1]) * p,
    ];
}

/**
 * Min and max of the finite numbers in one or more arrays.
 * @param {ArrayLike<number|null|undefined>[]} arrays
 * @returns {[number, number] | null} null if there are no finite values
 */
export function dataExtent(arrays) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const a of arrays) {
        for (let i = 0; i < a.length; i++) {
            const v = a[i];
            if (typeof v === "number" && Number.isFinite(v)) {
                if (v < lo) {
                    lo = v;
                }
                if (v > hi) {
                    hi = v;
                }
            }
        }
    }
    return lo <= hi ? [lo, hi] : null;
}

/**
 * The range Plotly's autorange picks for line traces on a linear axis: the
 * data fills the middle 90% (5% of the axis length padded on each side), and
 * constant data gets ±1. Matching it means the animation lands exactly where
 * `autorange: true` would, so there's no snap when autorange is restored.
 * @param {[number, number]} extent data [min, max]
 * @returns {[number, number]}
 */
export function plotlyAutoRange([lo, hi]) {
    if (lo === hi) {
        return [lo - 1, hi + 1];
    }
    const pad = (hi - lo) * (0.05 / 0.9);
    return [lo - pad, hi + pad];
}

/** @returns {boolean} whether the user asked the OS for reduced motion */
export function prefersReducedMotion() {
    return typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs `step` once per animation frame for `duration` ms with the eased
 * progress, finishing with exactly step(1). If `step` returns a promise (e.g.
 * Plotly.relayout), the next frame waits for it, so slow frames are dropped
 * rather than queued. A duration of 0 just runs step(1).
 * @param {number} duration ms
 * @param {(p: number) => (unknown | Promise<unknown>)} step
 * @returns {{cancel: () => void, done: Promise<boolean>}} `done` resolves true
 *   when finished, false if cancelled — in both cases only after the last
 *   in-flight step has settled.
 */
export function animate(duration, step) {
    let cancelled = false;
    const done = (async () => {
        const start = performance.now();
        for (;;) {
            if (cancelled) {
                return false;
            }
            const t = duration > 0
                ? Math.min(1, (performance.now() - start) / duration)
                : 1;
            await step(easeInOutCubic(t));
            if (t >= 1) {
                return !cancelled;
            }
            await new Promise(r => requestAnimationFrame(r));
        }
    })();
    return { cancel: () => { cancelled = true; }, done };
}
