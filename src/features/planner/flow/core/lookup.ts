import type { Item } from '@/shared/@types/item.type'

/** Finds a stable catalog identity; missing entries remain undefined. */
export const findItemById = (items: readonly Item[], itemId: string) => items.find((item) => item.id === itemId)

/** Falls back to the stable ID when the catalog has no display name. */
export const getItemName = (items: readonly Item[], itemId: string) => findItemById(items, itemId)?.name || itemId

/** Returns the artwork category, with a raw-color fallback; this never authorizes a raw production route. */
export const getItemType = (items: readonly Item[], itemId: string) => findItemById(items, itemId)?.type || 'raw'
