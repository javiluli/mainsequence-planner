import type { ProductionMachineNode } from '@/features/planner/flow/types'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ProductionNodeCard } from './production-node-card'

export const ProductionNode = ({ data, selected }: NodeProps<ProductionMachineNode>) => {
  return (
    <ProductionNodeCard data={data} selected={selected}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </ProductionNodeCard>
  )
}
