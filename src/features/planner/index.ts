import { lazy } from 'react'

/** Primary controls are eager: production measurements favor immediate selector availability. */
export { PlannerToolbar } from './ui/toolbar/planner-toolbar'
export { ProductionDiagramTabs } from './flow/diagram'

export { useOpenPlanner } from './hooks/use-open-planner'
export { useOpenBases } from './hooks/use-open-bases'
export { useProductionPlan } from './hooks/use-production-plan'
export { getPlanProductionStages, getCatalogProductionStages } from './lib/production-plan/production-stages'
export { summarizeRequiredBuildings } from './lib/production-plan/required-buildings'
export type { ProductionPlan, RequiredBuilding } from './lib/production-plan/types'
export { ProductionPlanProvider } from './providers/production-plan-provider'

export const ItemNetworkBackground = lazy(() =>
  import('./ui/item-network-background').then((module) => ({
    default: module.ItemNetworkBackground,
  })),
)
