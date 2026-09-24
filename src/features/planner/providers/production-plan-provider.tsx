import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import { buildings, externallyAcquiredItemIds, itemById, items, producerBuildingsByItemId } from '@/shared/data'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { ProductionPlanContext } from '../hooks/use-production-plan'

interface ProductionPlanProviderProps {
  children: ReactNode
}

// Raw catalog identities are authoritative: a missing recipe does not make an unknown item a mineral.
const rawItemIds = new Set(items.filter((item) => item.type === 'raw').map((item) => item.id))

/** Calculates one production plan and shares it with the diagram; Zustand owns only editable inputs. */
export const ProductionPlanProvider = ({ children }: ProductionPlanProviderProps) => {
  const targetId = usePlannerStore(plannerSelectors.targetId)
  const targetIpm = usePlannerStore(plannerSelectors.targetIpm)
  const supplyCountByItem = usePlannerStore(plannerSelectors.supplyCountByItem)
  const recipeIdByItemId = usePlannerStore(plannerSelectors.recipeIdByItemId)

  const plan = useMemo(() => {
    if (!targetId) return null

    const targetItem = itemById.get(targetId)

    return buildProductionPlan({
      buildings,
      producerBuildingsByItemId,
      targetId,
      targetIpm,
      isRawTarget: targetItem?.type === 'raw',
      rawItemIds,
      externalItemIds: externallyAcquiredItemIds,
      supplyCountByItem,
      recipeIdByItemId,
    })
  }, [targetId, targetIpm, supplyCountByItem, recipeIdByItemId])

  return <ProductionPlanContext value={plan}>{children}</ProductionPlanContext>
}
