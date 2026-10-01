import { lazy } from 'react'

export const ProductionDiagramTabs = lazy(() => import('./flow/diagram').then((module) => ({ default: module.ProductionDiagramTabs })))
export { useOpenPlanner } from './hooks/use-open-planner'
export { useOpenBases } from './hooks/use-open-bases'
export { useProductionPlan } from './hooks/use-production-plan'
export type { ProductionPlan } from './lib/production-plan'
export { ProductionPlanProvider } from './providers/production-plan-provider'
export const ItemNetworkBackground = lazy(() =>
  import('./ui/item-network-background').then((module) => ({ default: module.ItemNetworkBackground })),
)
export const PlannerToolbar = lazy(() => import('./ui/toolbar/planner-toolbar').then((module) => ({ default: module.PlannerToolbar })))
