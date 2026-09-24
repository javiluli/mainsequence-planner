import type { RawBuilding } from '@/shared/@types/building.type'
import type { RawItem } from '@/shared/@types/item.type'
import buildingsCatalog from './main-sequence/buildings_and_recipes.json'
import itemsCatalog from './main-sequence/items.json'
import {
  getExternallyAcquiredItemIds,
  indexByproductBuildingsByItemId,
  indexProducerBuildingsByItemId,
  isProductionBuilding,
} from './building-production'
import { createCatalogIndex, createItemNameIndex } from './catalog-indexes'
import { normalizeBuildings, normalizeItems } from './catalog-normalization'

/** Compact source records; optional source values such as power stay optional. */
const rawBuildings: readonly RawBuilding[] = buildingsCatalog

/** Items before validating the categories supported by the application. */
const rawItems: readonly RawItem[] = itemsCatalog

/** Normalized buildings. Missing power means unknown, never zero. */
export const buildings = normalizeBuildings(rawBuildings)

/** Items normalized exclusively from the generated game catalog. */
export const items = normalizeItems(rawItems)

/** Stable item lookup derived from the source data. */
export const itemById = createCatalogIndex(items)

/** Stable building lookup derived from the source data. */
export const buildingById = createCatalogIndex(buildings)

/** Lightweight display-name lookup. */
export const itemNameById = createItemNameIndex(items)

/** Every real producer for an item, in source order. */
export const producerBuildingsByItemId = indexProducerBuildingsByItemId(buildings)

/** Secondary outputs are listed separately because they are not standalone recipes. */
export const byproductBuildingsByItemId = indexByproductBuildingsByItemId(buildings)

/** Existing game items acquired outside machine production, derived from every recipe output. */
export const externallyAcquiredItemIds = getExternallyAcquiredItemIds(items, buildings)

/** Real production machines exposed to filters and recipe views. */
export const productionBuildings = buildings.filter(isProductionBuilding)

export {
  getExternallyAcquiredItemIds,
  indexByproductBuildingsByItemId,
  indexProducerBuildingsByItemId,
  isProductionBuilding,
} from './building-production'

// Science points are metadata, not production recipes.
export {
  researchScienceTypes,
  researchItems,
  researchTechnologies,
  researchScienceTypeById,
  researchItemById,
  researchTechnologyById,
  researchTechnologiesByRecipeId,
} from './research-catalog'
export { inspectResearchCatalog } from './research-integrity'
