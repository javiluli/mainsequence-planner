import { describe, expect, it } from 'vitest'
import { getTreeNodeInfo } from './tree-node-info'
import type { TreeNodeData } from '../types'

const names = new Map([
  ['T_TitaniumOre', 'Titanium Ore'],
  ['T_TitaniumPlates1', 'Titanium Plates'],
])

describe('getTreeNodeInfo', () => {
  it('renders an external ore input with its item icon and name, without a machine count', () => {
    const node: TreeNodeData = { itemId: 'T_TitaniumOre', targetIpm: 60, isRawMaterial: true, children: [] }

    expect(getTreeNodeInfo(node, names)).toMatchObject({
      label: 'Titanium Ore',
      iconKind: 'items',
      iconId: 'T_TitaniumOre',
      showBuildingCount: false,
    })
  })

  it('keeps a real recipe node attached to its machine icon', () => {
    const node: TreeNodeData = {
      itemId: 'T_TitaniumPlates1',
      targetIpm: 20,
      buildingId: 'refinery',
      buildingName: 'Refinery',
      buildingCount: 1,
      children: [],
    }

    expect(getTreeNodeInfo(node, names)).toMatchObject({
      label: 'Refinery',
      iconKind: 'buildings',
      iconId: 'refinery',
      showBuildingCount: true,
    })
  })
})
