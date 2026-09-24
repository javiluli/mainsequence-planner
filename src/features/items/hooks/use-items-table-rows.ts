import { buildItemsTableRows } from '@/features/items/lib/build-items-table-rows'
import { byproductBuildingsByItemId, items, producerBuildingsByItemId, researchItemById, researchScienceTypeById } from '@/shared/data'

const itemTableRows = buildItemsTableRows(
  items,
  producerBuildingsByItemId,
  researchItemById,
  researchScienceTypeById,
  byproductBuildingsByItemId,
)

export const useItemsTableRows = () => itemTableRows
