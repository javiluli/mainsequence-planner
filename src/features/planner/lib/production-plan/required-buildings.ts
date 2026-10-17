import type { ProductionStep, RequiredBuilding } from './types'

/**
 * Groups physical counts by machine type, preserving first appearance and catalog metadata.
 * Rounded counts from different recipes are additive: each step needs its own continuous-production capacity.
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
