import type { ProductionNodeData } from '@/features/planner/flow/types'
import type { ProductionStep } from '@/features/planner/lib/production-plan'
import type { Item } from '@/shared/@types/item.type'
import { getItemName } from './lookup'

/** Converts one calculated production step into the data consumed by a visual node. */
export const buildProductionNodeData = (step: ProductionStep, items: readonly Item[]): ProductionNodeData => ({
  itemId: step.itemId,
  itemName: getItemName(items, step.itemId),
  buildingId: step.buildingId,
  buildingName: step.buildingName,
  buildingLoad: step.buildingLoad,
  buildingCount: step.buildingCount,
  baseIpm: step.recipeOutputIpm,
  targetIpm: step.targetIpm,
  buildingPower: step.buildingPower,
  ...(step.recycledIpm !== undefined ? { recycledIpm: step.recycledIpm } : {}),
  ...(step.extraOutputs?.length
    ? { extraOutputs: step.extraOutputs.map((output) => ({ ...output, name: getItemName(items, output.id) })) }
    : {}),
})
