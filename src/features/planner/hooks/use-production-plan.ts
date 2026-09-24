import { createContext, useContext } from 'react'
import type { ProductionPlan } from '@/features/planner/lib/production-plan'

export const ProductionPlanContext = createContext<ProductionPlan | null | undefined>(undefined)

/** Returns the single production plan calculated for the current Planner page. */
export const useProductionPlan = () => {
  const plan = useContext(ProductionPlanContext)

  if (plan === undefined) {
    throw new Error('useProductionPlan must be used within ProductionPlanProvider')
  }

  return plan
}
