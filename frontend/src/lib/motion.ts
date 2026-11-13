/**
 * Motion tokens for the places that animate from JavaScript (framer-motion, recharts).
 * The CSS side reads the same values from the --motion-* and --ease-out-soft variables in index.css; keep the two in step.
 * Durations are short on purpose: motion explains a change, it never makes anyone wait.
 */
export const DURATION = { fast: 0.15, base: 0.2, slow: 0.3 } as const

/** A soft ease-out: quick start, gentle landing. No bounce, no overshoot. */
export const EASE = [0.22, 0.61, 0.36, 1] as const

/** Recharts draws bars, lines and rings once on mount. This is the one place a duration above `slow` is allowed. */
export const CHART_DRAW_MS = 450
