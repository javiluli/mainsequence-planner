import { summarizeRequiredBuildings } from './production-plan/required-buildings'
import type { ProductionStep } from './production-plan/types'

/** Construction units for one material, both per machine and across its required count. */
export interface BuildingConstructionCostMaterial {
  itemId: string
  amountPerBuilding: number
  totalAmount: number
}

/** Physical machine requirement; an empty material list is meaningful only when hasCostData is true. */
export interface BuildingConstructionCostRow {
  buildingId: string
  buildingName: string
  buildingCount: number
  materials: readonly BuildingConstructionCostMaterial[]
  hasCostData: boolean
}

/** Total construction units of a material shared by all known machine costs. */
export interface BuildingConstructionMaterialTotal {
  itemId: string
  totalAmount: number
}

/** Known construction totals plus an explicit warning when some machines lack catalog costs. */
export interface BuildingConstructionCostSummary {
  rows: readonly BuildingConstructionCostRow[]
  materials: readonly BuildingConstructionMaterialTotal[]
  hasUnknownCosts: boolean
}

/**
 * Applies the catalog construction cost to the already-calculated physical machine counts.
 *
 * Production rates and building quantities are deliberately not recalculated here.
 * Buildings without source-backed construction data stay explicit and are always shown first.
 */
export const buildBuildingConstructionCostSummary = (steps?: readonly ProductionStep[]): BuildingConstructionCostSummary | null => {
  if (!steps?.length) return null

  const requiredBuildings = summarizeRequiredBuildings(steps)
  const unknownRows: BuildingConstructionCostRow[] = []
  const knownRows: BuildingConstructionCostRow[] = []
  const materialTotals = new Map<string, number>()

  for (const building of requiredBuildings) {
    const constructionCost = building.buildingConstructionCost

    if (constructionCost === undefined) {
      unknownRows.push({
        buildingId: building.buildingId,
        buildingName: building.buildingName,
        buildingCount: building.buildingCount,
        materials: [],
        hasCostData: false,
      })

      continue
    }

    const materials = constructionCost.map((material) => {
      const totalAmount = material.amount * building.buildingCount

      materialTotals.set(material.id, (materialTotals.get(material.id) ?? 0) + totalAmount)

      return {
        itemId: material.id,
        amountPerBuilding: material.amount,
        totalAmount,
      }
    })

    knownRows.push({
      buildingId: building.buildingId,
      buildingName: building.buildingName,
      buildingCount: building.buildingCount,
      materials,
      hasCostData: true,
    })
  }

  return {
    rows: [...unknownRows, ...knownRows],
    materials: Array.from(materialTotals, ([itemId, totalAmount]) => ({
      itemId,
      totalAmount,
    })),
    hasUnknownCosts: unknownRows.length > 0,
  }
}
