import { useCallback, useMemo, useState } from 'react'

const getResolvedNodeId = <TNode>(node: TNode, path: string, getNodeId?: (node: TNode, path: string) => string) => {
  if (getNodeId) return getNodeId(node, path)

  const nodeId = (node as { id?: string }).id
  return nodeId ? `${path}::${nodeId}` : path
}

const collectNodeIds = <TNode>(
  data: TNode[],
  getChildren: (node: TNode) => TNode[] | undefined,
  getNodeId?: (node: TNode, path: string) => string,
) => {
  const ids: string[] = []
  const stack: Array<{ node: TNode; path: string }> = data.map((node, index) => ({ node, path: `${index}` }))

  while (stack.length) {
    const current = stack.pop()
    if (!current) continue

    ids.push(getResolvedNodeId(current.node, current.path, getNodeId))

    getChildren(current.node)?.forEach((child, index) => {
      stack.push({ node: child, path: `${current.path}.${index}` })
    })
  }

  return ids
}

export const useTreeExpansion = <TNode>(
  data: TNode[],
  getChildren: (node: TNode) => TNode[] | undefined,
  getNodeId?: (node: TNode, path: string) => string,
  defaultExpanded = true,
) => {
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(() =>
    defaultExpanded ? new Set() : new Set(collectNodeIds(data, getChildren, getNodeId)),
  )

  const expandedMap = useMemo(() => {
    const map = new Map<string, boolean>()
    const stack: Array<{ node: TNode; path: string }> = data.map((node, index) => ({ node, path: `${index}` }))

    while (stack.length) {
      const current = stack.pop()
      if (!current) continue

      const nodeId = getResolvedNodeId(current.node, current.path, getNodeId)
      map.set(nodeId, !collapsedSet.has(nodeId))

      getChildren(current.node)?.forEach((child, index) => {
        stack.push({ node: child, path: `${current.path}.${index}` })
      })
    }

    return map
  }, [data, getChildren, getNodeId, collapsedSet])

  const toggle = useCallback((nodeId: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  return { expandedMap, toggle }
}
