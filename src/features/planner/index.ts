import { lazy } from 'react'

export const ProductionDiagramTabs = lazy(() => import('./flow/diagram').then((module) => ({ default: module.ProductionDiagramTabs })))
export { useOpenPlanner } from './hooks/use-open-planner'
export { useProductionPlan } from './hooks/use-production-plan'
export { ProductionPlanProvider } from './providers/production-plan-provider'
export { RandomItemMarquee } from './ui/random-item-marquee'
export const PlannerSidebar = lazy(() => import('./ui/sidebar/planner-sidebar').then((module) => ({ default: module.PlannerSidebar })))
export const PlannerToolbar = lazy(() => import('./ui/toolbar/planner-toolbar').then((module) => ({ default: module.PlannerToolbar })))
