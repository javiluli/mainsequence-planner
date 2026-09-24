import type { ItemType } from '@/shared/@types/item.type'
import type { PlannerFlowEdge } from '../types'
import type { Graph } from '@dagrejs/dagre'
import { FLOW_COLORS } from '../config/flow-theme'

interface ConnectParams {
  edges: PlannerFlowEdge[]
  dagreGraph: Graph
  itemName: string
  itemId: string
  itemType: ItemType
  consumerId: string
  totalNeeded: number
  supplyCountInventory: Record<string, number>
}

/**
 * Conecta supply y produccion en un mismo flujo.
 *
 * Regla: primero consume supply y luego conecta produccion.
 *
 * @param params Datos necesarios para crear edges y actualizar inventario.
 */
export const connectSupplyAndProduction = ({
  edges,
  dagreGraph,
  itemName,
  itemId,
  itemType,
  consumerId,
  totalNeeded,
  supplyCountInventory,
}: ConnectParams) => {
  if (totalNeeded <= 0) return

  let remaining = totalNeeded

  const available = supplyCountInventory[itemId] || 0
  if (available > 0) {
    const taken = Math.min(available, remaining)
    supplyCountInventory[itemId] -= taken
    remaining -= taken

    edges.push({
      id: `react-flow__edge-supply-${itemId}-${consumerId}`,
      type: 'productionEdge',
      source: `supply-${itemId}`,
      target: consumerId,
      label: `${itemName} x${taken.toFixed(1)}/m`,
      data: { itemName, amountPerMinute: taken },
      ariaLabel: `${itemName}: ${taken.toFixed(1)} items per minute supplied`,
      animated: true,
      style: {
        stroke: FLOW_COLORS.supplyEdge,
        strokeWidth: 6,
        strokeDasharray: '5 5',
      },
      className: `e-supply-${itemType}`,
    })
    dagreGraph.setEdge(`supply-${itemId}`, consumerId)
  }

  if (remaining > 0) {
    edges.push({
      id: `e-${itemId}-${consumerId}`,
      type: 'productionEdge',
      source: itemId,
      target: consumerId,
      label: `${itemName} x${remaining.toFixed(1)}/m`,
      data: { itemName, amountPerMinute: remaining },
      ariaLabel: `${itemName}: ${remaining.toFixed(1)} items per minute`,
      style: {
        strokeWidth: 4,
        opacity: 0.8,
      },
      className: `react-flow__edge-${itemType}`,
    })
    dagreGraph.setEdge(itemId, consumerId)
  }
}
