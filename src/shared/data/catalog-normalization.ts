import type { Building, RawBuilding } from '@/shared/@types/building.type'
import type { Item, ItemType, RawItem } from '@/shared/@types/item.type'

/** Tipos de item que entienden actualmente los filtros, agrupaciones y cálculos. */
const ITEM_TYPES = new Set<string>(['raw', 'processed', 'component'])

/** Comprueba que un string externo sea un tipo de item soportado por la aplicación. */
const isItemType = (value: string): value is ItemType => ITEM_TYPES.has(value)

/** Makes optional recipe arrays explicit without changing source IDs or quantities. */
export const normalizeBuildings = (rawBuildings: readonly RawBuilding[]): readonly Building[] =>
  rawBuildings.map((building) => ({ ...building, recipes: building.recipes ?? [] }))

/** Rejects unsupported categories instead of inventing a fallback. */
export const normalizeItems = (rawItems: readonly RawItem[]): readonly Item[] =>
  rawItems.map((item) => {
    if (!isItemType(item.type)) throw new Error(`Unsupported item type "${item.type}" for ${item.id}`)

    return {
      ...item,
      type: item.type,
    }
  })
