import type { ProductionPlan } from '@/features/planner'
import { MACHINE_TYPES, PLACEABLES, type PlaceableType } from '../model/catalog'
import type { BaseStation } from './placement'

const placeableByBuildingId: Readonly<Partial<Record<string, PlaceableType>>> = {
  refinery: 'refinery',
  fabricator: 'assembler',
  enrichment: 'enrichment',
}

export interface PlanMachineRow {
  buildingId: string
  name: string
  required: number
  /** Null means the plan's building cannot be placed from the current palette. */
  placed: number | null
}

/** Counts machines once by their owning placement, including machines spanning modules. */
export function countBaseBuildings(stations: readonly BaseStation[]): ReadonlyMap<PlaceableType, number> {
  const placedByType = new Map<PlaceableType, number>()
  for (const station of stations) {
    for (const piece of station.placements) {
      if (PLACEABLES[piece.type].category === 'machine') placedByType.set(piece.type, (placedByType.get(piece.type) ?? 0) + 1)
    }
  }
  return placedByType
}

/** Informational building counts, independent of products, belts and production rates. */
export function summarizePlanComparison(plan: ProductionPlan, stations: readonly BaseStation[]) {
  const placedByType = countBaseBuildings(stations)

  const requiredByBuilding = new Map<string, { name: string; required: number }>()
  for (const step of plan.steps) {
    const current = requiredByBuilding.get(step.buildingId)
    requiredByBuilding.set(step.buildingId, {
      name: step.buildingName,
      required: (current?.required ?? 0) + step.buildingCount,
    })
  }

  const machines: PlanMachineRow[] = [...requiredByBuilding].map(([buildingId, row]) => {
    const type = placeableByBuildingId[buildingId]
    return { buildingId, ...row, placed: type ? (placedByType.get(type) ?? 0) : null }
  })

  return { machines }
}

export interface BaseBuildingRow {
  id: string
  name: string
  placed: number | null
  required: number | null
}

export function baseBuildingRows(stations: readonly BaseStation[], plan: ProductionPlan | null = null): BaseBuildingRow[] {
  const counts = countBaseBuildings(stations)
  const validPlan = plan && plan.issues.length === 0 ? plan : null
  const planned = validPlan ? summarizePlanComparison(validPlan, stations).machines : []
  const plannedTypes = new Set(planned.map((row) => placeableByBuildingId[row.buildingId]).filter((type) => type !== undefined))
  return [
    ...planned.map((row) => ({ id: row.buildingId, name: row.name, placed: row.placed, required: row.required })),
    ...MACHINE_TYPES.filter((type) => counts.has(type) && !plannedTypes.has(type)).map((type) => ({
      id: type,
      name: PLACEABLES[type].label,
      placed: counts.get(type) ?? 0,
      required: validPlan ? 0 : null,
    })),
  ]
}
