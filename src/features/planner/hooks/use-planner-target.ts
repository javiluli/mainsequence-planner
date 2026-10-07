import { useCallback } from 'react'
import { producerBuildingsByItemId } from '@/shared/data'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { findRecipeForItem } from '@/features/planner/lib/recipes'

export const usePlannerTarget = () => {
  const setTargetId = usePlannerStore(plannerSelectors.setTargetId)
  const setTargetIpm = usePlannerStore(plannerSelectors.setTargetIpm)

  const selectTargetItem = useCallback(
    (id: string) => {
      if (!id) {
        setTargetId('')
        return
      }

      const { recipe } = findRecipeForItem(producerBuildingsByItemId, id)
      const baseIpm = recipe ? recipe.output.amount_per_minute : 1

      setTargetId(id)
      setTargetIpm(baseIpm)
    },
    [setTargetId, setTargetIpm],
  )

  const setTargetRate = useCallback(
    (value: number) => {
      setTargetIpm(value)
    },
    [setTargetIpm],
  )

  return {
    selectTargetItem,
    setTargetRate,
  }
}
