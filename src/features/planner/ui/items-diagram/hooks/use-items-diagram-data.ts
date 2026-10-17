import { useMemo } from 'react'
import type { ProductionStep } from '../../../lib'
import { buildItemsTableData } from '../lib/items-data'

/** Memoizes the item table projection without modifying the plan's shared step order. */
export const useItemsDiagramData = (steps?: ProductionStep[]) => {
  return useMemo(() => buildItemsTableData(steps), [steps])
}
