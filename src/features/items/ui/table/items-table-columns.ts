export type ColumnKey = 'item' | 'category' | 'actions' | 'production'

export interface ItemsTableColumn {
  key: ColumnKey
  name: string
}

export const ITEMS_TABLE_COLUMNS: ItemsTableColumn[] = [
  { key: 'item', name: 'Item' },
  { key: 'category', name: 'Category' },
  { key: 'actions', name: 'Actions' },
  { key: 'production', name: 'Production' },
]

/** Adjust these percentages together (total 100%). Widths are relative to the table, not the entire page. */
export const ITEMS_TABLE_COLUMN_WIDTHS: Record<ColumnKey, string> = {
  item: '24%',
  category: '15%',
  actions: '30%',
  production: '31%',
}

export const ITEMS_TABLE_ESTIMATED_ROW_HEIGHT = 72
export const ITEMS_TABLE_OVERSCAN = 8
