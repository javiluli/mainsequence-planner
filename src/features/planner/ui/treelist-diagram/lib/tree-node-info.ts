import type { IconKind } from '@/shared/ui/asset-image'
import type { TreeNodeData } from '../types'

const getItemName = (itemMap: ReadonlyMap<string, string>, itemId: string) => itemMap.get(itemId) ?? itemId

export const getTreeNodeInfo = (node: TreeNodeData, itemNameMap: ReadonlyMap<string, string>) => {
  const isSupply = Boolean(node.isSupply)
  const itemLabel = getItemName(itemNameMap, node.itemId)
  const hasMachine = Boolean(node.buildingId && !node.isRawMaterial && !isSupply && !node.isFinalProduct)
  const label = hasMachine ? node.buildingName : itemLabel
  const iconKind: IconKind = hasMachine ? 'buildings' : 'items'
  const iconId = hasMachine && node.buildingId ? node.buildingId : node.itemId
  const showBuildingCount = hasMachine

  return {
    isSupply,
    label,
    itemLabel,
    iconKind,
    iconId,
    showBuildingCount,
    supplyCount: node.supplyCount ?? 0,
  }
}
