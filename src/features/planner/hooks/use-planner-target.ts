import { plannerSelectors, usePlannerStore } from '@/store/planner.store'

/** Exposes atomic target selection and manual rate editing without subscribing to calculated or saved inputs. */
export const usePlannerTarget = () => {
  const selectTargetItem = usePlannerStore(plannerSelectors.selectTargetItem)
  const setTargetRate = usePlannerStore(plannerSelectors.setTargetIpm)

  return {
    selectTargetItem,
    setTargetRate,
  }
}
