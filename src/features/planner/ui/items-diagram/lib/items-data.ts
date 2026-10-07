import type { ProductionStep } from '../../../lib'

export const buildItemsTableData = (steps?: ProductionStep[]) => {
  if (!steps?.length) return null
  return [...steps].reverse()
}
