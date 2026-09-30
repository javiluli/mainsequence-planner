import type { ProductionPlan } from '@/features/planner'
import { PLACEABLES, type PlaceableType } from '../model/catalog'
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

/** A whole-layout inventory, deliberately independent of recipe assignments and belt flow. */
export function summarizePlanComparison(plan: ProductionPlan, stations: readonly BaseStation[]) {
  const placements = stations.flatMap((station) => station.placements)
  const placedByType = new Map<PlaceableType, number>()
  for (const piece of placements) placedByType.set(piece.type, (placedByType.get(piece.type) ?? 0) + 1)

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

  return {
    machines,
    mk1BeltCells: placedByType.get('conveyor') ?? 0,
    mk2BeltCells: placedByType.get('conveyor_mk2') ?? 0,
    mk1Capacity: PLACEABLES.conveyor.capacityPerMinute,
    mk2Capacity: PLACEABLES.conveyor_mk2.capacityPerMinute,
  }
}
