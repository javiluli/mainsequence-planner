export const getTreeNodeKey = (path: string, node: { itemId: string; buildingId?: string }) =>
  `${path}::${node.itemId}-${node.buildingId ?? 'raw'}`
