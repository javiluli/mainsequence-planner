import { getPlanProductionStages, getCatalogProductionStages, summarizeRequiredBuildings, type ProductionPlan } from '@/features/planner'
import { MACHINE_TYPES, PLACEABLES, type PlaceableType } from '../../model/catalog'
import type { BaseStation } from '../layout/placement'
import type { Recipe } from '@/shared/@types/building.type'
import { itemNameById } from '@/shared/data'
import { recipeForPlaceable, recipeOutputs } from './machine-recipes'
import { placeableForBuilding } from './catalog-machines'

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

  const machines: PlanMachineRow[] = summarizeRequiredBuildings(plan.steps).map(({ buildingId, buildingName, buildingCount }) => {
    const type = placeableForBuilding(buildingId)
    return { buildingId, name: buildingName, required: buildingCount, placed: type ? (placedByType.get(type) ?? 0) : null }
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
  const plannedTypes = new Set(planned.map((row) => placeableForBuilding(row.buildingId)).filter((type) => type !== undefined))
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

export interface BaseProductRow {
  id: string
  name: string
  nominal: number
  /** Planner dependency depth; zero denotes an external input. Also drives visual grouping. */
  stage: number
  /** Net planner demand, not nominal gross capacity; null outside a valid plan. */
  target: number | null
}

/** Full-speed catalog output per assigned machine, including coproducts, never a belt simulation. */
export function baseProductRows(stations: readonly BaseStation[], plan: ProductionPlan | null = null): BaseProductRow[] {
  const nominalByItem = new Map<string, number>()
  const assignedRecipes = new Set<Recipe>()
  for (const station of stations) {
    for (const piece of station.placements) {
      const recipe = recipeForPlaceable(piece.type, piece.recipeId)
      if (!recipe) continue
      assignedRecipes.add(recipe)
      for (const output of recipeOutputs(recipe)) {
        nominalByItem.set(output.id, (nominalByItem.get(output.id) ?? 0) + output.amount_per_minute)
      }
    }
  }
  const targets = new Map<string, number>()
  const validPlan = plan && !plan.issues.length ? plan : null
  for (const step of validPlan?.steps ?? []) targets.set(step.itemId, (targets.get(step.itemId) ?? 0) + step.targetIpm)
  if (validPlan && !targets.has(validPlan.targetId)) {
    // A fully supplied target (or an external leaf) has no production step. Keep its residual
    // demand explicit instead of restoring the original request and reporting a false deficit.
    targets.set(validPlan.targetId, Math.max(0, validPlan.targetIpm - (validPlan.supplyCountByItem[validPlan.targetId] ?? 0)))
  }
  const productIds = [...new Set([...targets.keys(), ...nominalByItem.keys()])]
  const assignedStages = getCatalogProductionStages(productIds, [...assignedRecipes])
  const plannedStages = validPlan ? getPlanProductionStages(validPlan) : new Map<string, number>()
  // A fully supplied item appears only as a supply-* source in Planner.
  const stageFor = (id: string) => plannedStages.get(id) ?? plannedStages.get(`supply-${id}`) ?? assignedStages.get(id) ?? 0
  return productIds
    .map((id) => ({
      id,
      name: itemNameById.get(id) ?? id,
      nominal: nominalByItem.get(id) ?? 0,
      stage: stageFor(id),
      target: validPlan ? (targets.get(id) ?? 0) : null,
    }))
    .sort((first, second) => first.stage - second.stage || first.name.localeCompare(second.name) || first.id.localeCompare(second.id))
}
