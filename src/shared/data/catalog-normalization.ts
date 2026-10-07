import type { Building, ConstructionCost, RawBuilding } from '@/shared/@types/building.type'
import type { Item, ItemType, RawItem } from '@/shared/@types/item.type'

/** Categorías que los filtros y cálculos actuales entienden; añadir aquí y en ItemType si cambia items.json. */
const ITEM_TYPES = new Set<string>(['raw', 'processed', 'component'])

/** Acota la categoría leída del JSON antes de exponerla como ItemType. */
const isItemType = (value: string): value is ItemType => ITEM_TYPES.has(value)

/** Cost quantities are units, not rates. Missing data stays unknown; an explicit empty list is a known free construction. */
const normalizeConstructionCost = (building: RawBuilding, itemIds?: ReadonlySet<string>): ConstructionCost[] | undefined => {
  if (building.construction_cost === undefined) return undefined
  const amounts = new Map<string, number>()
  for (const material of building.construction_cost) {
    if (!material.id || (itemIds && !itemIds.has(material.id))) {
      throw new Error(`Unknown construction material ${material.id} for ${building.id}`)
    }
    if (!Number.isFinite(material.amount) || material.amount <= 0) {
      throw new Error(`Invalid construction amount for ${building.id}: ${material.id}`)
    }
    amounts.set(material.id, (amounts.get(material.id) ?? 0) + material.amount)
  }
  return [...amounts].map(([id, amount]) => ({ id, amount }))
}

/** Normaliza costes en la frontera y da recetas vacías a máquinas sin ellas; conserva IDs, ratios y potencia. */
export const normalizeBuildings = (rawBuildings: readonly RawBuilding[], itemIds?: ReadonlySet<string>): readonly Building[] =>
  rawBuildings.map((building) => ({
    ...building,
    recipes: building.recipes ?? [],
    ...(building.construction_cost !== undefined ? { construction_cost: normalizeConstructionCost(building, itemIds) } : {}),
  }))

/** Rechaza una categoría nueva en vez de clasificarla erróneamente como materia prima u objeto procesado. */
export const normalizeItems = (rawItems: readonly RawItem[]): readonly Item[] =>
  rawItems.map((item) => {
    if (!isItemType(item.type)) throw new Error(`Unsupported item type "${item.type}" for ${item.id}`)

    return {
      ...item,
      type: item.type,
    }
  })
