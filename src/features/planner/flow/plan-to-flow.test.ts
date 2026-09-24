import type { ProductionPlan } from '@/features/planner/lib/production-plan'
import type { Item } from '@/shared/@types/item.type'
import { describe, expect, it } from 'vitest'
import { planToFlow } from './plan-to-flow'
import { FLOW_NODE_SIZE, getProductionNodeHeight } from './core/flow-nodes'
import type { PlannerFlowNode } from './types'

const NODE_WIDTH = FLOW_NODE_SIZE.width
const nodeHeight = (node: PlannerFlowNode) =>
  node.type === 'productionNode' ? getProductionNodeHeight(node.data) : FLOW_NODE_SIZE.externalHeight

const items: Item[] = [
  { id: 'plate', name: 'Plate', type: 'processed' },
  { id: 'ingot', name: 'Ingot', type: 'processed' },
  { id: 'wire', name: 'Wire', type: 'component' },
  { id: 'ore', name: 'Ore', type: 'raw' },
  { id: 'copper', name: 'Copper', type: 'raw' },
]

const plan: ProductionPlan = {
  targetId: 'plate',
  targetIpm: 10,
  isRawTarget: false,
  supplyCountByItem: { ore: 40, copper: 20, invalid: 0 },
  supplyCountInventory: { ore: 40, copper: 20, invalid: 0 },
  rawInputs: [],
  issues: [],
  steps: [
    {
      itemId: 'plate',
      buildingId: 'assembler',
      buildingName: 'Assembler',
      recipeOutputIpm: 10,
      targetIpm: 10,
      buildingLoad: 1,
      buildingCount: 1,
      buildingPower: 10,
      supplyCount: 0,
      inputs: [
        { id: 'ingot', amount_per_minute: 20 },
        { id: 'wire', amount_per_minute: 10 },
      ],
    },
    {
      itemId: 'ingot',
      buildingId: 'smelter',
      buildingName: 'Smelter',
      recipeOutputIpm: 20,
      targetIpm: 20,
      buildingLoad: 1,
      buildingCount: 1,
      buildingPower: 5,
      supplyCount: 0,
      inputs: [{ id: 'ore', amount_per_minute: 40 }],
    },
    {
      itemId: 'wire',
      buildingId: 'wire_mill',
      buildingName: 'Wire Mill',
      recipeOutputIpm: 10,
      targetIpm: 10,
      buildingLoad: 1,
      buildingCount: 1,
      buildingPower: 5,
      supplyCount: 0,
      inputs: [{ id: 'copper', amount_per_minute: 20 }],
    },
  ],
  stats: { buildings: 3, power: 20 },
}

const rectanglesOverlap = (first: PlannerFlowNode, second: PlannerFlowNode) =>
  first.position.x < second.position.x + NODE_WIDTH &&
  first.position.x + NODE_WIDTH > second.position.x &&
  first.position.y < second.position.y + nodeHeight(second) &&
  first.position.y + nodeHeight(first) > second.position.y

describe('planToFlow layout', () => {
  it('keeps the production graph connected, left-to-right and without overlapping nodes', () => {
    const { nodes, edges } = planToFlow({ plan, items })
    const nodeById = new Map(nodes.map((node) => [node.id, node]))

    expect(new Set(nodes.map((node) => node.id))).toEqual(new Set(['plate', 'ingot', 'wire', 'supply-ore', 'supply-copper']))
    expect(new Set(edges.map((edge) => `${edge.source}->${edge.target}`))).toEqual(
      new Set(['ingot->plate', 'wire->plate', 'supply-ore->ingot', 'supply-copper->wire']),
    )
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'ingot',
          target: 'plate',
          data: { itemName: 'Ingot', amountPerMinute: 20 },
        }),
        expect.objectContaining({
          source: 'supply-ore',
          target: 'ingot',
          data: { itemName: 'Ore', amountPerMinute: 40 },
        }),
      ]),
    )

    nodes.forEach((node) => {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
    })

    edges.forEach((edge) => {
      expect(nodeById.get(edge.source)?.position.x).toBeLessThan(nodeById.get(edge.target)?.position.x ?? Number.NEGATIVE_INFINITY)
    })

    nodes.forEach((node, index) => {
      nodes.slice(index + 1).forEach((otherNode) => {
        expect(rectanglesOverlap(node, otherNode), `${node.id} overlaps ${otherNode.id}`).toBe(false)
      })
    })
  })

  it('does not render an incomplete graph as a valid production network', () => {
    const invalidPlan: ProductionPlan = {
      ...plan,
      issues: [{ code: 'missing-recipe', itemId: 'ingot', message: 'Missing recipe for ingot' }],
    }
    expect(planToFlow({ plan: invalidPlan, items })).toEqual({ nodes: [], edges: [] })
  })

  it('aligns dependency ranks into movable, spaced stages without losing edges', () => {
    const network = planToFlow({ plan, items })
    const staged = planToFlow({ plan, items, layoutMode: 'stages' })
    const nodeById = new Map(staged.nodes.map((node) => [node.id, node]))

    const stagePositions = [...new Set(staged.nodes.map((node) => node.position.x))].sort((first, second) => first - second)
    expect(stagePositions).toHaveLength(3)
    expect(stagePositions[1] - stagePositions[0] - NODE_WIDTH).toBeGreaterThanOrEqual(200)
    expect(staged.nodes.every((node) => node.draggable)).toBe(true)
    expect(staged.edges.map((edge) => edge.id)).toEqual(network.edges.map((edge) => edge.id))
    expect(nodeById.get('supply-ore')?.position.x).toBe(nodeById.get('supply-copper')?.position.x)
    expect(nodeById.get('ingot')?.position.x).toBe(nodeById.get('wire')?.position.x)
    expect(nodeById.get('supply-ore')?.position.x).toBeLessThan(nodeById.get('ingot')?.position.x ?? 0)
    expect(nodeById.get('ingot')?.position.x).toBeLessThan(nodeById.get('plate')?.position.x ?? 0)

    staged.nodes.forEach((node, index) => {
      staged.nodes.slice(index + 1).forEach((otherNode) => {
        expect(rectanglesOverlap(node, otherNode), `${node.id} overlaps ${otherNode.id}`).toBe(false)
      })
    })
  })
})
