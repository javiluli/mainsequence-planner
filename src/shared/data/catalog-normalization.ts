import type { Building, RawBuilding } from '@/shared/@types/building.type'
import type { Item, ItemType, RawItem } from '@/shared/@types/item.type'

/** Categorías que los filtros y cálculos actuales entienden; añadir aquí y en ItemType si cambia items.json. */
const ITEM_TYPES = new Set<string>(['raw', 'processed', 'component'])

/** Acota la categoría leída del JSON antes de exponerla como ItemType. */
const isItemType = (value: string): value is ItemType => ITEM_TYPES.has(value)

/** Da una lista vacía a máquinas sin recetas; no altera IDs, ratios ni potencia. */
export const normalizeBuildings = (rawBuildings: readonly RawBuilding[]): readonly Building[] =>
  rawBuildings.map((building) => ({ ...building, recipes: building.recipes ?? [] }))

/** Rechaza una categoría nueva en vez de clasificarla erróneamente como materia prima u objeto procesado. */
export const normalizeItems = (rawItems: readonly RawItem[]): readonly Item[] =>
  rawItems.map((item) => {
    if (!isItemType(item.type)) throw new Error(`Unsupported item type "${item.type}" for ${item.id}`)

    return {
      ...item,
      type: item.type,
    }
  })
