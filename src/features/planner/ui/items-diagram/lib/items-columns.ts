export type ProductionItemsColumnKey = 'item' | 'needed'

export interface ProductionItemsColumn {
  key: ProductionItemsColumnKey
  name: string
}

export const PRODUCTION_ITEMS_COLUMNS: ProductionItemsColumn[] = [
  { key: 'item', name: 'Item' },
  { key: 'needed', name: 'Needed / min' },
]
