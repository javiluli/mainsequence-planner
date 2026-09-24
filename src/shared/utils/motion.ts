const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Avoids smooth programmatic scrolling when the operating system requests less motion. */
export const getPreferredScrollBehavior = (): ScrollBehavior => (globalThis.matchMedia?.(REDUCED_MOTION_QUERY).matches ? 'auto' : 'smooth')
