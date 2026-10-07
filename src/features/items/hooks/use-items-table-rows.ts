import { buildItemsTableRows } from '@/features/items/lib/build-items-table-rows'
import { byproductBuildingsByItemId, items, producerBuildingsByItemId } from '@/shared/data'

const itemTableRows = buildItemsTableRows(items, producerBuildingsByItemId, byproductBuildingsByItemId)

export const useItemsTableRows = () => itemTableRows
