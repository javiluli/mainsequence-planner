import type { Item } from '@/shared/@types/item.type'

export const SUPPLY_ITEM_TYPE_ORDER: Item['type'][] = ['raw', 'processed', 'component']

export const filterItemsByQuery = (items: readonly Item[], query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return items
  return items.filter((item) => item.name.toLowerCase().includes(normalized))
}

export const groupItemsByType = (items: readonly Item[]) =>
  items.reduce<Record<Item['type'], Item[]>>(
    (acc, item) => {
      acc[item.type].push(item)
      return acc
    },
    {
      raw: [],
      processed: [],
      component: [],
    },
  )
