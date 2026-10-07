import type { Building } from '@/shared/@types/building.type'

/**
 * Busca en el catalogo que edificio y que receta corresponden a un item especifico.
 *
 * @param producersByItemId Indice de edificios productores por item.
 * @param itemId Id del item a resolver.
 * @returns Objeto con building y recipe (si existen).
 */
export const findRecipeForItem = (producersByItemId: ReadonlyMap<string, readonly Building[]>, itemId: string) => {
  const building = producersByItemId.get(itemId)?.[0]
  const recipe = building?.recipes.find((candidate) => candidate.output.id === itemId)
  return { building, recipe }
}
