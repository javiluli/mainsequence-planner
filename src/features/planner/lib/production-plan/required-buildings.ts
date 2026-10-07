import type { ProductionStep, RequiredBuilding } from './types'

/**
 * Groups recipe-specific production steps by physical machine type.
 *
 * A single building type may appear in several steps because one machine can host
 * several recipes. Those steps still represent independent continuous-production
 * capacity, so their rounded physical machine counts are additive.
 *
 * Steps resolve their metadata from the same normalized catalog record for each
 * building ID; only the physical count is accumulated.
 * Map insertion order preserves the first occurrence of each building in the plan.
 */
export const summarizeRequiredBuildings = (steps: readonly ProductionStep[]): RequiredBuilding[] => {
  const requiredByBuilding = new Map<string, RequiredBuilding>()

  for (const step of steps) {
    const current = requiredByBuilding.get(step.buildingId)

    if (current) {
      current.buildingCount += step.buildingCount
      continue
    }

    requiredByBuilding.set(step.buildingId, {
      buildingId: step.buildingId,
      buildingName: step.buildingName,
      buildingCount: step.buildingCount,
      ...(step.buildingPower !== undefined ? { buildingPower: step.buildingPower } : {}),
      ...(step.buildingConstructionCost !== undefined ? { buildingConstructionCost: step.buildingConstructionCost } : {}),
    })
  }

  return [...requiredByBuilding.values()]
}
