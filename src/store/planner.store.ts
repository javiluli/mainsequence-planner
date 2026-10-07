import { normalizeTargetIpm } from '@/features/planner/lib/planner-logic'
import { isPositiveSupplyCount, normalizeSupplyCountByItem } from '@/features/planner/lib/supply-count'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface PlannerStoreState {
  targetId: string
  targetIpm: number
  supplyCountByItem: Record<string, number>
  recipeIdByItemId: Record<string, string>
  setTargetId: (id: string) => void
  setTargetIpm: (value: number) => void
  setRecipeForItem: (itemId: string, recipeId: string) => void
  resetRecipes: () => void
  setSupply: (itemId: string, amount: number) => void
  incrementSupply: (itemId: string, delta: number) => void
  removeSupply: (itemId: string) => void
}

export const plannerSelectors = {
  targetId: (state: PlannerStoreState) => state.targetId,
  targetIpm: (state: PlannerStoreState) => state.targetIpm,
  supplyCountByItem: (state: PlannerStoreState) => state.supplyCountByItem,
  recipeIdByItemId: (state: PlannerStoreState) => state.recipeIdByItemId,
  setTargetId: (state: PlannerStoreState) => state.setTargetId,
  setTargetIpm: (state: PlannerStoreState) => state.setTargetIpm,
  setRecipeForItem: (state: PlannerStoreState) => state.setRecipeForItem,
  resetRecipes: (state: PlannerStoreState) => state.resetRecipes,
  setSupply: (state: PlannerStoreState) => state.setSupply,
  incrementSupply: (state: PlannerStoreState) => state.incrementSupply,
  removeSupply: (state: PlannerStoreState) => state.removeSupply,
}

const removeRecordKey = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const next = { ...record }
  delete next[key]
  return next
}

const setSupply = (supplyCountByItem: Record<string, number>, itemId: string, amount: number) =>
  isPositiveSupplyCount(amount) ? { ...supplyCountByItem, [itemId]: amount } : removeRecordKey(supplyCountByItem, itemId)

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeStringRecord = (value: unknown) => {
  if (!isRecord(value)) return {}

  const normalized: Record<string, string> = {}
  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === 'string' && entry.length > 0) normalized[key] = entry
  })
  return normalized
}

const mergePersistedPlannerState = (persistedState: unknown, currentState: PlannerStoreState): PlannerStoreState => {
  if (!isRecord(persistedState)) return currentState

  const targetId = typeof persistedState.targetId === 'string' ? persistedState.targetId : currentState.targetId
  const storedTargetIpm = typeof persistedState.targetIpm === 'number' ? persistedState.targetIpm : currentState.targetIpm

  return {
    ...currentState,
    targetId,
    targetIpm: normalizeTargetIpm(storedTargetIpm, Boolean(targetId)),
    supplyCountByItem: normalizeSupplyCountByItem(persistedState.supplyCountByItem),
    // Older session snapshots have no recipe selections; they still hydrate safely.
    recipeIdByItemId: normalizeStringRecord(persistedState.recipeIdByItemId),
  }
}

/** Stores only user-editable Planner inputs; calculated output remains derived state. */
export const usePlannerStore = create<PlannerStoreState>()(
  persist(
    (set) => ({
      targetId: '',
      targetIpm: 0,
      supplyCountByItem: {},
      recipeIdByItemId: {},
      setTargetId: (targetId) =>
        set((state) => ({
          targetId,
          targetIpm: normalizeTargetIpm(state.targetIpm, Boolean(targetId)),
        })),
      setTargetIpm: (targetIpm) => set((state) => ({ targetIpm: normalizeTargetIpm(targetIpm, Boolean(state.targetId)) })),
      setRecipeForItem: (itemId, recipeId) =>
        set((state) => ({
          recipeIdByItemId: recipeId ? { ...state.recipeIdByItemId, [itemId]: recipeId } : removeRecordKey(state.recipeIdByItemId, itemId),
        })),
      resetRecipes: () => set({ recipeIdByItemId: {} }),
      setSupply: (itemId, amount) =>
        set((state) => ({
          supplyCountByItem: setSupply(state.supplyCountByItem, itemId, amount),
        })),
      incrementSupply: (itemId, delta) =>
        set((state) => {
          const currentAmount = isPositiveSupplyCount(state.supplyCountByItem[itemId]) ? state.supplyCountByItem[itemId] : 0
          return { supplyCountByItem: setSupply(state.supplyCountByItem, itemId, currentAmount + delta) }
        }),
      removeSupply: (itemId) => set((state) => ({ supplyCountByItem: removeRecordKey(state.supplyCountByItem, itemId) })),
    }),
    {
      name: 'zstore.planner',
      storage: createJSONStorage(() => sessionStorage),
      merge: mergePersistedPlannerState,
    },
  ),
)
