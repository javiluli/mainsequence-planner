import type { Building } from '@/shared/@types/building.type'
import type { Item } from '@/shared/@types/item.type'

const NON_PRODUCING_BUILDING_TYPES = new Set(['generator', 'transport', 'temperature', 'habitat', 'defense', 'storage', 'core'])

/** Regla compartida que identifica los buildings capaces de producir items. */
export const isProductionBuilding = (building: Building) => !NON_PRODUCING_BUILDING_TYPES.has(building.type)

/** Indexa todos los productores de cada output respetando el orden del catálogo. */
export const indexProducerBuildingsByItemId = (buildings: readonly Building[]): ReadonlyMap<string, readonly Building[]> => {
  const producersByItemId = new Map<string, Building[]>()

  buildings.forEach((building) => {
    building.recipes.forEach((recipe) => {
      const producers = producersByItemId.get(recipe.output.id) ?? []
      if (producers.some((producer) => producer.id === building.id)) return

      producers.push(building)
      producersByItemId.set(recipe.output.id, producers)
    })
  })

  return producersByItemId
}

/** Secondary outputs are real products, but are not standalone production routes. */
export const indexByproductBuildingsByItemId = (buildings: readonly Building[]): ReadonlyMap<string, readonly Building[]> => {
  const byproductBuildingsByItemId = new Map<string, Building[]>()

  buildings.forEach((building) => {
    building.recipes.forEach((recipe) => {
      recipe.extra_outputs?.forEach((output) => {
        const producers = byproductBuildingsByItemId.get(output.id) ?? []
        if (producers.some((producer) => producer.id === building.id)) return

        producers.push(building)
        byproductBuildingsByItemId.set(output.id, producers)
      })
    })
  })

  return byproductBuildingsByItemId
}

/** Existing non-raw items with no primary or secondary machine output need external acquisition. */
export const getExternallyAcquiredItemIds = (items: readonly Item[], buildings: readonly Building[]): ReadonlySet<string> => {
  const producedIds = new Set(
    buildings.flatMap((building) =>
      building.recipes.flatMap((recipe) => [recipe.output.id, ...(recipe.extra_outputs ?? []).map((output) => output.id)]),
    ),
  )
  return new Set(items.filter((item) => item.type !== 'raw' && !producedIds.has(item.id)).map((item) => item.id))
}
