import type { Building } from '@/shared/@types/building.type'
import type { Item } from '@/shared/@types/item.type'

/** El selector de Items solo muestra Crafters con al menos una receta exportada del juego. */
export const isProductionBuilding = (building: Building): boolean => building.recipes.length > 0

/** Relaciona cada resultado principal con sus máquinas, sin repetir una máquina que tenga varias recetas para el mismo objeto. */
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

/** Los subproductos también tienen productor, pero no constituyen una receta independiente para ese objeto. */
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

/** Los objetos que no son materias primas y carecen de salida conocida se tratan como suministro externo, no como máquinas ficticias. */
export const getExternallyAcquiredItemIds = (items: readonly Item[], buildings: readonly Building[]): ReadonlySet<string> => {
  const producedIds = new Set(
    buildings.flatMap((building) =>
      building.recipes.flatMap((recipe) => [recipe.output.id, ...(recipe.extra_outputs ?? []).map((output) => output.id)]),
    ),
  )
  return new Set(items.filter((item) => item.type !== 'raw' && !producedIds.has(item.id)).map((item) => item.id))
}
