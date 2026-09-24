export type ColumnKey = 'item' | 'category' | 'research' | 'production' | 'actions'

export interface ItemsTableColumn {
  key: ColumnKey
  name: string
}

export const ITEMS_TABLE_COLUMNS: ItemsTableColumn[] = [
  { key: 'item', name: 'Item' },
  { key: 'category', name: 'Category' },
  { key: 'research', name: 'Research' },
  { key: 'production', name: 'Production' },
  { key: 'actions', name: 'Actions' },
]

export const ITEMS_TABLE_COLUMN_WIDTHS: Record<ColumnKey, string> = {
  item: '33%',
  category: '15%',
  research: '22%',
  production: '20%',
  actions: '10%',
}

export const ITEMS_TABLE_ESTIMATED_ROW_HEIGHT = 72
export const ITEMS_TABLE_OVERSCAN = 8
