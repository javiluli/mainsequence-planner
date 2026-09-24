const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Continuous delivery in items/min. This is not the number of items stored in a warehouse. */
export type SupplyRateByItem = Readonly<Record<string, number>>

/** Finite starting quantities in items; they cannot sustain a production rate indefinitely. */
export type StockQuantityByItem = Readonly<Record<string, number>>

/** A unit discriminator prevents treating one-time stock as a continuous input. */
export interface ContinuousDelivery {
  kind: 'continuous-rate'
  rates: SupplyRateByItem
}

export interface StartingStock {
  kind: 'starting-stock'
  quantities: StockQuantityByItem
}

export type MaterialSource = ContinuousDelivery | StartingStock

/** Historical name retained for callers: every count in this module means items/min. */
export function isPositiveSupplyCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Keep fractional deliveries such as 0.5 items/min; drop invalid or exhausted rates. */
export function normalizeSupplyCountByItem(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}

  const normalized: Record<string, number> = {}

  Object.entries(value).forEach(([itemId, amount]) => {
    if (itemId && isPositiveSupplyCount(amount)) normalized[itemId] = amount
  })

  return normalized
}

/** A starting stock never offsets steady-state demand, even if its numeric value matches a rate. */
export function getSteadyStateSupplyRates(source: MaterialSource): Record<string, number> {
  if (source.kind === 'starting-stock') return {}
  return normalizeSupplyCountByItem(source.rates)
}

export function getSupplyCountItemIds(supplyCountByItem: Record<string, number>): string[] {
  return Object.keys(normalizeSupplyCountByItem(supplyCountByItem))
}
