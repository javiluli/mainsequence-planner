import { useMemo } from 'react'
import { buildBuildingConstructionCostSummary, type ProductionStep } from '../../../lib'

/** Memoizes the presentation summary while the calculated production steps remain unchanged. */
export const useBuildingCostData = (steps?: readonly ProductionStep[]) =>
  useMemo(() => buildBuildingConstructionCostSummary(steps), [steps])
