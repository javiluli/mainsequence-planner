import { useMemo } from 'react'
import type { ProductionStep } from '../../../lib'
import { buildItemsTableData } from '../lib/items-data'

export const useItemsDiagramData = (steps?: ProductionStep[]) => {
  return useMemo(() => buildItemsTableData(steps), [steps])
}
