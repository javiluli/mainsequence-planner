import { Graph, layout } from '@dagrejs/dagre'
import { Position, type Node } from '@xyflow/react'
import type { Building } from '@/shared/@types/building.type'
import type { Item } from '@/shared/@types/item.type'
import { buildPlanResolver } from '@/features/planner/lib/production-plan/plan-resolver'
import { getRecipeYield } from '@/features/planner/lib/production-plan/recipe-yields'
import type { PlannerFlowEdge } from '@/features/planner/flow/types'

export type PartialRecipeNode = Node<
  {
    itemId: string
    itemName: string
    buildingId: string
    buildingName: string
    recipeId: string
    nominalOutputIpm: number
    netOutputIpm: number
    recycledIpm: number
    extraOutputNames: string[]
  },
  'partialRecipe'
>

export type PartialSourceNode = Node<
  {
    itemId: string
    itemName: string
    sourceKind: 'raw' | 'coproduct' | 'unconfirmed'
    byproductBuildingNames: string[]
  },
  'partialSource'
>

export type PartialFlowNode = PartialRecipeNode | PartialSourceNode
export type PartialFlowEdge = PlannerFlowEdge

interface PartialRecipeFlowParams {
  targetId: string
  buildings: readonly Building[]
  items: readonly Item[]
  producerBuildingsByItemId: ReadonlyMap<string, readonly Building[]>
  byproductBuildingsByItemId: ReadonlyMap<string, readonly Building[]>
  recipeIdByItemId?: Record<string, string>
}

interface PartialRecipeFlow {
  nodes: PartialFlowNode[]
  edges: PartialFlowEdge[]
  unconfirmedItemIds: string[]
}

const RECIPE_NODE_SIZE = { width: 236, height: 128 }
const SOURCE_NODE_SIZE = { width: 212, height: 100 }

/** A dependency map only: nominal recipe rates are shown, never unverified factory totals. */
export const buildPartialRecipeFlow = ({
  targetId,
  buildings,
  items,
  producerBuildingsByItemId,
  byproductBuildingsByItemId,
  recipeIdByItemId = {},
}: PartialRecipeFlowParams): PartialRecipeFlow => {
  const resolver = buildPlanResolver(buildings, producerBuildingsByItemId, recipeIdByItemId)
  const itemById = new Map(items.map((item) => [item.id, item]))
  const nodes = new Map<string, PartialFlowNode>()
  const edges: PartialFlowEdge[] = []
  const unconfirmedItemIds = new Set<string>()
  const active = new Set<string>()

  const visit = (itemId: string) => {
    if (nodes.has(itemId) || active.has(itemId)) return
    active.add(itemId)

    const itemName = itemById.get(itemId)?.name ?? itemId
    const useRawSource = itemById.get(itemId)?.type === 'raw' && !recipeIdByItemId[itemId]
    const recipe = useRawSource ? null : resolver.getRecipeForItem(itemId)
    const building = recipe ? resolver.getBuildingForItem(itemId) : null

    if (recipe && building) {
      const { netOutputRate, recycledRate, externalInputs } = getRecipeYield(recipe, itemId)
      const extraOutputNames = (recipe.extra_outputs ?? []).map((output) => itemById.get(output.id)?.name ?? output.id)
      nodes.set(itemId, {
        id: itemId,
        type: 'partialRecipe',
        position: { x: 0, y: 0 },
        data: {
          itemId,
          itemName,
          buildingId: building.id,
          buildingName: building.name,
          recipeId: recipe.id ?? itemId,
          nominalOutputIpm: recipe.output.amount_per_minute,
          netOutputIpm: netOutputRate,
          recycledIpm: recycledRate,
          extraOutputNames,
        },
      })

      for (const input of externalInputs) {
        visit(input.id)
        edges.push({
          id: `${input.id}->${itemId}`,
          source: input.id,
          target: itemId,
          type: 'productionEdge',
          data: { itemName: itemById.get(input.id)?.name ?? input.id, amountPerMinute: input.amount_per_minute },
        })
      }
    } else {
      const byproductBuildingNames = (byproductBuildingsByItemId.get(itemId) ?? []).map((producer) => producer.name)
      const sourceKind = useRawSource ? 'raw' : byproductBuildingNames.length ? 'coproduct' : 'unconfirmed'
      if (sourceKind !== 'raw') unconfirmedItemIds.add(itemId)
      nodes.set(itemId, {
        id: itemId,
        type: 'partialSource',
        position: { x: 0, y: 0 },
        data: { itemId, itemName, sourceKind, byproductBuildingNames },
      })
    }

    active.delete(itemId)
  }

  if (targetId) visit(targetId)

  const graph = new Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', ranksep: 148, nodesep: 32, edgesep: 18 })
  for (const node of nodes.values()) {
    graph.setNode(node.id, { ...(node.type === 'partialRecipe' ? RECIPE_NODE_SIZE : SOURCE_NODE_SIZE) })
  }
  for (const edge of edges) graph.setEdge(edge.source, edge.target)
  layout(graph)

  return {
    nodes: [...nodes.values()].map((node) => {
      const placed = graph.node(node.id)
      const size = node.type === 'partialRecipe' ? RECIPE_NODE_SIZE : SOURCE_NODE_SIZE
      return {
        ...node,
        position: { x: placed.x - size.width / 2, y: placed.y - size.height / 2 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      }
    }),
    edges,
    unconfirmedItemIds: [...unconfirmedItemIds].sort(),
  }
}
