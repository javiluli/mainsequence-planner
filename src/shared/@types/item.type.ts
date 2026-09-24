export type ItemType = 'raw' | 'processed' | 'component'

export interface RawItem {
  id: string
  name: string
  type: string
}

/** Item with an explicitly supported catalog category. */
export interface Item extends Omit<RawItem, 'type'> {
  type: ItemType
}
