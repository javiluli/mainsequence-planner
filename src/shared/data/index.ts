import type { RawBuilding } from '@/shared/@types/building.type'
import type { Item, RawItem } from '@/shared/@types/item.type'
import buildingsCatalog from './main-sequence/buildings_and_recipes.json'
import itemsCatalog from './main-sequence/items.json'
import {
  getExternallyAcquiredItemIds,
  indexByproductBuildingsByItemId,
  indexProducerBuildingsByItemId,
  isProductionBuilding,
} from './building-production'
import { normalizeBuildings, normalizeItems } from './catalog-normalization'

// Frontera de datos: el generador produce los JSON; este módulo solo los adapta e indexa una vez al cargarse.
// Si cambia su estructura, actualizar los tipos Raw*, la normalización y el generador juntos.
const rawBuildings: readonly RawBuilding[] = buildingsCatalog
const rawItems: readonly RawItem[] = itemsCatalog

/** Objetos del JSON con la categoría admitida por la aplicación. */
export const items = normalizeItems(rawItems)

/** Todas las máquinas del catálogo proceden de Crafter; potencia/coste ausentes siguen siendo desconocidos. */
export const buildings = normalizeBuildings(rawBuildings, new Set(items.map((item) => item.id)))

/** Consulta de objetos por ID estable, sin depender del nombre visible. */
export const itemById: ReadonlyMap<string, Item> = new Map(items.map((item) => [item.id, item]))

/** Solo los nombres necesarios para etiquetas del planner. */
export const itemNameById: ReadonlyMap<string, string> = new Map(items.map((item) => [item.id, item.name]))

/** Productores de resultados principales, en el orden del JSON. */
export const producerBuildingsByItemId = indexProducerBuildingsByItemId(buildings)

/** Productores de subproductos; separados de las rutas principales. */
export const byproductBuildingsByItemId = indexByproductBuildingsByItemId(buildings)

/** Objetos que no son materias primas y no salen de ninguna receta conocida. */
export const externallyAcquiredItemIds = getExternallyAcquiredItemIds(items, buildings)

/** Máquinas con recetas reales para el filtro de Items; no usa categorías heredadas de otros juegos. */
export const productionBuildings = buildings.filter(isProductionBuilding)

export {
  getExternallyAcquiredItemIds,
  indexByproductBuildingsByItemId,
  indexProducerBuildingsByItemId,
  isProductionBuilding,
} from './building-production'

// La ciencia aporta puntos y desbloqueos; no crea recetas de producción adicionales.
export {
  researchScienceTypes,
  researchItems,
  researchTechnologies,
  researchScienceTypeById,
  researchItemById,
  researchTechnologyById,
  researchTechnologiesByRecipeId,
} from './research-catalog'
