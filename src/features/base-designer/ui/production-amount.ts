/** Compact display rates keep unknown values and small positive quantities distinct from zero. */
export function productionAmount(value: number | null): number | string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value > 0 && value < 0.1) return '<0.1'
  return Math.round(value * 10) / 10
}
