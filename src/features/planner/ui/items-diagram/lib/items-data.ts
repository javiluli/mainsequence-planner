import type { ProductionStep } from '../../../lib'

/** Copies steps in reverse plan order for display; absent production returns the table's empty-state signal. */
export const buildItemsTableData = (steps?: ProductionStep[]) => {
  if (!steps?.length) return null
  return [...steps].reverse()
}
