import { lazy } from 'react'

export const ProductionDiagramTabs = lazy(() =>
  import('./flow/diagram').then((module) => ({
    default: module.ProductionDiagramTabs,
  })),
)

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

export const PlannerToolbar = lazy(() =>
  import('./ui/toolbar/planner-toolbar').then((module) => ({
    default: module.PlannerToolbar,
  })),
)
