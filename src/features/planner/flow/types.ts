import type { Edge, Node } from '@xyflow/react'

export type ProductionNodeData = {
  buildingId: string
  buildingName: string
  /** Source energy use per machine in MJ; undefined means unknown. */
  buildingPower?: number
  buildingLoad: number
  buildingCount: number
  itemId: string
  itemName: string
  baseIpm: number
  targetIpm: number
  /** Internal same-product circulation is never a separate factory input. */
  recycledIpm?: number
  /** Gross secondary outputs are informational until allocation is implemented. */
  extraOutputs?: readonly { id: string; name: string; amount_per_minute: number }[]
}

export type SupplyNodeData = {
  itemId: string
  itemName: string
  /** User-entered continuous external delivery in items/min. */
  supplyCount: number
}

/** Raw resources enter from warehouses/drones; no fictional mine or factory is shown. */
export type RawResourceNodeData = {
  itemId: string
  itemName: string
  /** Distinguishes mined/warehouse raw resources from non-machine acquisitions such as survey data. */
  isRawMaterial?: boolean
  /** Derived demand rate, not a claim about extraction throughput. */
  demandIpm?: number
  /** User-entered continuous external delivery in items/min. */
  supplyAmount?: number
}

export type ProductionMachineNode = Node<ProductionNodeData, 'productionNode'>
export type SupplyFlowNode = Node<SupplyNodeData, 'supplyNode'>
export type RawResourceFlowNode = Node<RawResourceNodeData, 'rawResourceNode'>

export type PlannerFlowNodeByType = {
  productionNode: ProductionMachineNode
  supplyNode: SupplyFlowNode
  rawResourceNode: RawResourceFlowNode
}

export type PlannerFlowNode = PlannerFlowNodeByType[keyof PlannerFlowNodeByType]

export type PlannerFlowEdge = Edge<
  { itemName: string; amountPerMinute: number; isByproduct?: boolean; emphasis?: 'connected' | 'dimmed' },
  'productionEdge'
>
