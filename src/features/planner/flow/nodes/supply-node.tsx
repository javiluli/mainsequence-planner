import type { SupplyFlowNode } from '@/features/planner/flow/types'
import { AssetImage } from '@/shared/ui'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FlowNodeShell } from './flow-node-shell'
import { FlowNodeOutputRate } from './node-parts'

export function SupplyNode({ data, selected }: NodeProps<SupplyFlowNode>) {
  return (
    <FlowNodeShell selected={selected}>
      <Handle type="target" position={Position.Left} className="bg-foreground! opacity-0" />
      <Handle type="source" position={Position.Right} className="bg-foreground!" />
      <div className="border-b border-divider/70 px-3 py-2 text-xs font-semibold tracking-[0.08em] text-foreground/70 uppercase">
        External supply
      </div>
      <div className="flex items-center gap-3 px-3 py-3">
        <AssetImage kind="items" id={data.itemId} width={48} alt="" />
        <FlowNodeOutputRate itemName={data.itemName} baseIpm={data.supplyCount} />
      </div>
      <div className="border-t border-divider/70 bg-content2/45 px-3 py-2 text-xs text-foreground/75">Warehouse / drone</div>
    </FlowNodeShell>
  )
}
