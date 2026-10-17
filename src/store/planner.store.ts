import { normalizeTargetIpm } from '@/features/planner/lib/planner-logic'
import { buildPlanResolver } from '@/features/planner/lib/production-plan/plan-resolver'
import { getTargetPresetIpm } from '@/features/planner/lib/recipes'
import { buildings, itemById, producerBuildingsByItemId } from '@/shared/data'
import { isPositiveSupplyCount, normalizeSupplyCountByItem } from '@/features/planner/lib/supply-count'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** Editable Planner inputs and their actions; all rates are items/min and calculated results stay outside the store. */
export interface PlannerStoreState {
  targetId: string
  targetIpm: number
  supplyCountByItem: Record<string, number>
  recipeIdByItemId: Record<string, string>
  /**
   * Selects a target and its net one-machine preset atomically, preserving unrelated recipes and supply.
   * @param recipeId Optional exact catalog recipe; omission keeps saved choices and the neutral fallback.
   * @returns False if an explicit recipe is missing or belongs to another output; state is then unchanged.
   */
  selectTargetItem: (itemId: string, recipeId?: string) => boolean
  setTargetId: (id: string) => void
  setTargetIpm: (value: number) => void
  /** An empty recipe ID removes the override and restores the resolver's default policy. */
  setRecipeForItem: (itemId: string, recipeId: string) => void
  resetRecipes: () => void
  /** Stores a positive finite delivery rate; zero, negative or invalid amounts remove that delivery. */
  setSupply: (itemId: string, amount: number) => void
  incrementSupply: (itemId: string, delta: number) => void
  removeSupply: (itemId: string) => void
}

export const plannerSelectors = {
  targetId: (state: PlannerStoreState) => state.targetId,
  targetIpm: (state: PlannerStoreState) => state.targetIpm,
  supplyCountByItem: (state: PlannerStoreState) => state.supplyCountByItem,
  recipeIdByItemId: (state: PlannerStoreState) => state.recipeIdByItemId,
  selectTargetItem: (state: PlannerStoreState) => state.selectTargetItem,
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

/** Accepts only nonempty string selections from untrusted saved state; route validity belongs to the resolver. */
const normalizeStringRecord = (value: unknown) => {
  if (!isRecord(value)) return {}

  const normalized: Record<string, string> = {}
  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === 'string' && entry.length > 0) normalized[key] = entry
  })
  return normalized
}

/** Hydrates known input fields without replacing live actions or trusting stored rates. */
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
    (set, get) => ({
      targetId: '',
      targetIpm: 0,
      supplyCountByItem: {},
      recipeIdByItemId: {},
      selectTargetItem: (targetId, recipeId) => {
        const state = get()
        const recipeIdByItemId = recipeId === undefined ? state.recipeIdByItemId : { ...state.recipeIdByItemId, [targetId]: recipeId }
        const resolver = buildPlanResolver(buildings, producerBuildingsByItemId, recipeIdByItemId)

        if (recipeId !== undefined && !resolver.hasSelectedRecipeForItem(targetId)) return false

        const preset = getTargetPresetIpm(resolver, targetId, itemById.get(targetId)?.type === 'raw')
        set({ targetId, targetIpm: normalizeTargetIpm(preset, Boolean(targetId)), recipeIdByItemId })
        return true
      },
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
