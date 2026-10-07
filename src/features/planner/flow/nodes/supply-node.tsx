import type { SupplyFlowNode } from '@/features/planner/flow/types'
import { AssetImage } from '@/shared/ui'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FlowNodeShell } from './flow-node-shell'
import { FlowNodeOutputRate } from './node-parts'
import { EditSupplyAction, RemoveSupplyAction } from '@/features/planner/ui/supply/supply-node-actions'

export function SupplyNode({ data, selected }: NodeProps<SupplyFlowNode>) {
  return (
    <FlowNodeShell selected={selected} className="border-primary/60 hover:border-primary hover:bg-content2">
      <Handle type="target" position={Position.Left} className="bg-foreground! opacity-0" />
      <Handle type="source" position={Position.Right} className="bg-foreground!" />
      <div className="flex min-h-9 items-center justify-between gap-1 border-b border-divider/70 px-3 py-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-foreground/70 uppercase">External supply</span>
        <div className="flex items-center gap-0.5">
          <EditSupplyAction itemId={data.itemId} itemName={data.itemName} suggestedRate={data.supplyCount} />
          <RemoveSupplyAction itemId={data.itemId} itemName={data.itemName} />
        </div>
      </div>
      <div className="flex items-center gap-3 px-3 py-3">
        <AssetImage kind="items" id={data.itemId} width={48} alt="" />
        <FlowNodeOutputRate itemName={data.itemName} baseIpm={data.supplyCount} />
      </div>
      <div className="border-t border-divider/70 bg-content2/45 px-3 py-2 text-xs text-foreground/75">Warehouse / drone</div>
    </FlowNodeShell>
  )
}
