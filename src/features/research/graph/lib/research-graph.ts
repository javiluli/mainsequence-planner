import type { ResearchTechnology } from '@/shared/@types/research.type'
import { Graph, layout } from '@dagrejs/dagre'
import type { BuiltInEdge } from '@xyflow/react'
import type { ResearchBranchFilter, ResearchFlowNode } from '../types'

export const RESEARCH_NODE_SIZE = {
  compact: { width: 184, height: 56 },
  focused: { width: 400, height: 182 },
} as const

const FOCUSED_ROW_GAP = 32
const FOCUSED_COLUMN_GAP = 112
const OVERVIEW_ROW_GAP = 24
const OVERVIEW_COLUMN_GAP = 40
const FOCUSED_DESCENDANT_RANKS = 5

/** Preserve Dagre's order, but use a shared vertical center per rank like the game's local tree. */
const centerFocusedRanks = (nodes: readonly ResearchFlowNode[]): ResearchFlowNode[] => {
  const ranks = new Map<number, ResearchFlowNode[]>()
  for (const node of nodes) {
    const width = node.selected ? RESEARCH_NODE_SIZE.focused.width : RESEARCH_NODE_SIZE.compact.width
    const rank = Math.round(node.position.x + width / 2)
    const column = ranks.get(rank) ?? []
    column.push(node)
    ranks.set(rank, column)
  }

  const centeredY = new Map<string, number>()
  for (const column of ranks.values()) {
    column.sort((first, second) => first.position.y - second.position.y || first.id.localeCompare(second.id))
    const heights = column.map((node) => (node.selected ? RESEARCH_NODE_SIZE.focused.height : RESEARCH_NODE_SIZE.compact.height))
    const totalHeight = heights.reduce((sum, height) => sum + height, FOCUSED_ROW_GAP * (column.length - 1))
    let y = -totalHeight / 2
    column.forEach((node, index) => {
      centeredY.set(node.id, y)
      y += heights[index] + FOCUSED_ROW_GAP
    })
  }

  const selectedCenter = nodes.find((node) => node.selected)
  const selectedOffset = selectedCenter ? (centeredY.get(selectedCenter.id) ?? 0) + RESEARCH_NODE_SIZE.focused.height / 2 : 0
  return nodes.map((node) => ({ ...node, position: { ...node.position, y: (centeredY.get(node.id) ?? node.position.y) - selectedOffset } }))
}

export interface ResearchGraphModel {
  nodes: ResearchFlowNode[]
  edges: BuiltInEdge[]
  matchedCount: number
  visibleCount: number
}

interface BuildResearchGraphOptions {
  technologies: readonly ResearchTechnology[]
  branch: ResearchBranchFilter
  query?: string
  focusedTechnologyId?: string
}

export const getResearchPrerequisiteIds = (technology: ResearchTechnology): readonly string[] => [
  ...new Set([...(technology.primary_prerequisite ? [technology.primary_prerequisite] : []), ...(technology.prerequisites ?? [])]),
]

const belongsToBranch = (technology: ResearchTechnology, branch: ResearchBranchFilter) => {
  if (branch === 'all') return true
  if (branch === 'general') return technology.costs.length === 0
  return technology.costs.some((cost) => cost.type === branch)
}

const collectBranchTechnologyIds = (
  technologies: readonly ResearchTechnology[],
  branch: ResearchBranchFilter,
): { visibleIds: Set<string>; contextualIds: Set<string> } => {
  const technologyById = new Map(technologies.map((technology) => [technology.id, technology]))
  const primaryIds = new Set(technologies.filter((technology) => belongsToBranch(technology, branch)).map((technology) => technology.id))

  if (branch === 'all') return { visibleIds: primaryIds, contextualIds: new Set() }

  const visibleIds = new Set(primaryIds)
  const pending = [...primaryIds]

  while (pending.length) {
    const technology = technologyById.get(pending.pop() ?? '')
    if (!technology) continue

    for (const prerequisiteId of getResearchPrerequisiteIds(technology)) {
      if (visibleIds.has(prerequisiteId) || !technologyById.has(prerequisiteId)) continue
      visibleIds.add(prerequisiteId)
      pending.push(prerequisiteId)
    }
  }

  return {
    visibleIds,
    contextualIds: new Set([...visibleIds].filter((id) => !primaryIds.has(id))),
  }
}

/** The supplied game views show all ancestors and five forward ranks; the native ResearchTreeView layout is not exported. */
export const collectFocusedTechnologyIds = (technologies: readonly ResearchTechnology[], focusedTechnologyId: string): Set<string> => {
  const technologyById = new Map(technologies.map((technology) => [technology.id, technology]))
  if (!technologyById.has(focusedTechnologyId)) return new Set()

  const dependantsById = new Map<string, string[]>()
  for (const technology of technologies) {
    for (const prerequisiteId of getResearchPrerequisiteIds(technology)) {
      const dependants = dependantsById.get(prerequisiteId) ?? []
      dependants.push(technology.id)
      dependantsById.set(prerequisiteId, dependants)
    }
  }

  const walk = (nextIds: (technologyId: string) => readonly string[]) => {
    const visited = new Set([focusedTechnologyId])
    const pending = [focusedTechnologyId]

    while (pending.length) {
      const technologyId = pending.pop() ?? ''
      for (const nextId of nextIds(technologyId)) {
        if (visited.has(nextId) || !technologyById.has(nextId)) continue
        visited.add(nextId)
        pending.push(nextId)
      }
    }

    return visited
  }

  const ancestors = walk((technologyId) => {
    const technology = technologyById.get(technologyId)
    return technology ? getResearchPrerequisiteIds(technology) : []
  })
  // Discover by shortest path first, then place by the longest path through the visible candidate tree.
  // Multi-prerequisite technologies must appear after both visible parents, not beside one of them.
  const descendantDistances = new Map([[focusedTechnologyId, 0]])
  const pending = [focusedTechnologyId]
  for (let index = 0; index < pending.length; index += 1) {
    const technologyId = pending[index]
    const nextDistance = (descendantDistances.get(technologyId) ?? 0) + 1
    if (nextDistance > FOCUSED_DESCENDANT_RANKS) continue
    for (const dependantId of dependantsById.get(technologyId) ?? []) {
      if (descendantDistances.has(dependantId) || !technologyById.has(dependantId)) continue
      descendantDistances.set(dependantId, nextDistance)
      pending.push(dependantId)
    }
  }

  const ranks = new Map([[focusedTechnologyId, 0]])
  const getRank = (technologyId: string, visiting = new Set<string>()): number => {
    const cached = ranks.get(technologyId)
    if (cached !== undefined) return cached
    if (visiting.has(technologyId)) throw new Error(`Research prerequisite cycle at ${technologyId}`)
    visiting.add(technologyId)
    const technology = technologyById.get(technologyId)
    const parentRanks = technology
      ? getResearchPrerequisiteIds(technology)
          .filter((id) => descendantDistances.has(id))
          .map((id) => getRank(id, visiting))
      : []
    visiting.delete(technologyId)
    const rank = 1 + Math.max(-1, ...parentRanks)
    ranks.set(technologyId, rank)
    return rank
  }

  const descendants = [...descendantDistances.keys()].filter((id) => getRank(id) <= FOCUSED_DESCENDANT_RANKS)
  return new Set([...ancestors, ...descendants])
}

const matchesQuery = (technology: ResearchTechnology, normalizedQuery: string) => {
  if (!normalizedQuery) return true

  return [technology.id, technology.name, ...technology.unlocks.flatMap((unlock) => [unlock.id, unlock.name ?? ''])].some((value) =>
    value.toLocaleLowerCase().includes(normalizedQuery),
  )
}

export const findResearchTechnologyMatch = (technologies: readonly ResearchTechnology[], query: string): ResearchTechnology | undefined => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return undefined

  return (
    technologies.find(
      (technology) => technology.name.toLocaleLowerCase() === normalizedQuery || technology.id.toLocaleLowerCase() === normalizedQuery,
    ) ?? technologies.find((technology) => matchesQuery(technology, normalizedQuery))
  )
}

export const buildResearchGraph = ({
  technologies,
  branch,
  query = '',
  focusedTechnologyId,
}: BuildResearchGraphOptions): ResearchGraphModel => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const branchSelection = collectBranchTechnologyIds(technologies, branch)
  const focusedIds = focusedTechnologyId ? collectFocusedTechnologyIds(technologies, focusedTechnologyId) : undefined
  const visibleIds = focusedIds?.size ? focusedIds : branchSelection.visibleIds
  const contextualIds = focusedIds?.size ? new Set<string>() : branchSelection.contextualIds
  const visibleTechnologies = technologies.filter((technology) => visibleIds.has(technology.id))
  const connectedIds = new Set<string>()
  for (const technology of technologies) {
    for (const prerequisiteId of getResearchPrerequisiteIds(technology)) {
      connectedIds.add(technology.id)
      connectedIds.add(prerequisiteId)
    }
  }
  const dagreGraph = new Graph().setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({
    rankdir: 'LR',
    nodesep: focusedIds?.size ? FOCUSED_ROW_GAP : OVERVIEW_ROW_GAP,
    ranksep: focusedIds?.size ? FOCUSED_COLUMN_GAP : OVERVIEW_COLUMN_GAP,
    marginx: 24,
    marginy: 24,
  })

  for (const technology of visibleTechnologies) {
    const size = technology.id === focusedTechnologyId ? RESEARCH_NODE_SIZE.focused : RESEARCH_NODE_SIZE.compact
    // Dagre mutates node labels with layout coordinates, so every node needs its own object.
    dagreGraph.setNode(technology.id, { ...size })
  }

  const edges = visibleTechnologies.flatMap((technology): BuiltInEdge[] =>
    getResearchPrerequisiteIds(technology).flatMap((prerequisiteId): BuiltInEdge[] => {
      if (!visibleIds.has(prerequisiteId)) return []
      dagreGraph.setEdge(prerequisiteId, technology.id, { weight: technology.primary_prerequisite === prerequisiteId ? 4 : 1 })
      const touchesFocus = prerequisiteId === focusedTechnologyId || technology.id === focusedTechnologyId

      return [
        {
          id: `${prerequisiteId}->${technology.id}`,
          source: prerequisiteId,
          target: technology.id,
          type: 'default',
          focusable: false,
          pathOptions: { curvature: 0.35 },
          className: touchesFocus ? 'research-flow__edge research-flow__edge--focus' : 'research-flow__edge',
        },
      ]
    }),
  )

  layout(dagreGraph)

  const dagreNodes = visibleTechnologies.map((technology): ResearchFlowNode => {
    const position = dagreGraph.node(technology.id)
    const size = technology.id === focusedTechnologyId ? RESEARCH_NODE_SIZE.focused : RESEARCH_NODE_SIZE.compact

    return {
      id: technology.id,
      type: 'researchTechnology',
      ariaRole: 'button',
      ariaLabel: `Open ${technology.name} research tree`,
      position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
      selected: technology.id === focusedTechnologyId,
      data: {
        technology,
        contextual: contextualIds.has(technology.id),
        dimmed: Boolean(normalizedQuery) && !matchesQuery(technology, normalizedQuery),
        independent: !connectedIds.has(technology.id),
      },
    }
  })

  const nodes = focusedIds?.size ? centerFocusedRanks(dagreNodes) : dagreNodes

  return {
    nodes,
    edges,
    matchedCount: normalizedQuery
      ? visibleTechnologies.filter((technology) => matchesQuery(technology, normalizedQuery)).length
      : nodes.length,
    visibleCount: nodes.length,
  }
}
