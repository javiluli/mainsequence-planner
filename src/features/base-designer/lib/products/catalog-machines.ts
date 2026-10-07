import { buildings } from '@/shared/data'
import type { Building } from '@/shared/@types/building.type'
import { MACHINE_TYPES, PLACEABLES, type PlaceableType } from '../../model/catalog'
import type { BaseStation } from '../layout/placement'

/** Palette types are presentation identities; only these types currently match real source Crafter IDs. */
const buildingIdByType: Readonly<Partial<Record<PlaceableType, string>>> = {
  refinery: 'refinery',
  assembler: 'fabricator',
  enrichment: 'enrichment',
}

const buildingById: ReadonlyMap<string, Building> = new Map(buildings.map((building) => [building.id, building]))
const typeByBuildingId = new Map<string, PlaceableType>()
for (const type of MACHINE_TYPES) {
  const id = buildingIdByType[type]
  if (id) typeByBuildingId.set(id, type)
}

/** Missing source records stay missing; never substitute a display name or fabricate a recipe/power value. */
export function catalogBuildingForPlaceable(type: PlaceableType): Building | undefined {
  const id = buildingIdByType[type]
  return id ? buildingById.get(id) : undefined
}

export function placeableForBuilding(buildingId: string): PlaceableType | undefined {
  return typeByBuildingId.get(buildingId)
}

export interface BaseEnergySummary {
  knownRequiredMj: number
  unknownMachineCount: number
  reactorCount: number
}

/** Sum nominal source MJ once per owned machine, without utilization scaling or inferred reactor generation.
 * Unknown consumers are counted separately; a declared zero is known, not missing.
 */
export function summarizeBaseEnergy(stations: readonly BaseStation[]): BaseEnergySummary {
  let knownRequiredMj = 0
  let unknownMachineCount = 0
  let reactorCount = 0
  for (const station of stations) {
    for (const piece of station.placements) {
      if (PLACEABLES[piece.type].category !== 'machine') continue
      const power = catalogBuildingForPlaceable(piece.type)?.power
      if (power === undefined) unknownMachineCount++
      else knownRequiredMj += power
      if (piece.type === 'reactor') reactorCount++
    }
  }
  return { knownRequiredMj, unknownMachineCount, reactorCount }
}
