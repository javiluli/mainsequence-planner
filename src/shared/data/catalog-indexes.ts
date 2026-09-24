import type { Item } from '@/shared/@types/item.type'

/** Crea un índice estable por ID sin modificar el array de origen. */
export const createCatalogIndex = <T extends { id: string }>(values: readonly T[]): ReadonlyMap<string, T> =>
  new Map(values.map((value): [string, T] => [value.id, value]))

/** Crea el índice ligero usado cuando una vista solo necesita el nombre de un item. */
export const createItemNameIndex = (items: readonly Item[]): ReadonlyMap<string, string> =>
  new Map(items.map((item) => [item.id, item.name]))
