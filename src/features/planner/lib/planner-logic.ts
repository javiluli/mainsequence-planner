/** Keeps the target rate consistent with whether a production target exists. */
export const normalizeTargetIpm = (value: number, hasTarget: boolean) => {
  if (!hasTarget) return 0
  if (!Number.isFinite(value)) return 1
  return Math.max(1, value)
}
