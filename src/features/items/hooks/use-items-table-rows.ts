import { buildItemsTableRows } from '@/features/items/lib/build-items-table-rows'
import { byproductBuildingsByItemId, items, producerBuildingsByItemId } from '@/shared/data'

const itemTableRows = buildItemsTableRows(items, producerBuildingsByItemId, byproductBuildingsByItemId)

/** Shares the catalog projection built once; consumers filter it without modifying its rows. */
export const useItemsTableRows = () => itemTableRows
