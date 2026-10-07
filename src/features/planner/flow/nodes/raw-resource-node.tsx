import type { RawResourceFlowNode } from '@/features/planner/flow/types'
import { AssetImage } from '@/shared/ui'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FlowNodeShell } from './flow-node-shell'
import { FlowNodeOutputRate } from './node-parts'
import { EditSupplyAction, RemoveSupplyAction } from '@/features/planner/ui/supply/supply-node-actions'

/** External acquisitions and raw minerals are inputs, never fictional production machines. */
export function RawResourceNode({ data, selected }: NodeProps<RawResourceFlowNode>) {
  const rate = data.demandIpm
  const isValidRate = rate !== undefined && Number.isFinite(rate)
  const isRawMaterial = data.isRawMaterial !== false

  return (
    <FlowNodeShell
      selected={selected}
      className={data.supplyAmount !== undefined ? 'border-primary/60 hover:border-primary hover:bg-content2' : undefined}
    >
      <Handle type="source" position={Position.Right} className="bg-primary!" />
      <div className="flex min-h-9 items-center justify-between gap-1 border-b border-divider/70 px-3 py-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-foreground/70 uppercase">
          {isRawMaterial ? 'Raw material' : 'External item'}
        </span>
        {!isRawMaterial && isValidRate ? (
          <EditSupplyAction itemId={data.itemId} itemName={data.itemName} suggestedRate={rate} />
        ) : data.supplyAmount !== undefined ? (
          <RemoveSupplyAction itemId={data.itemId} itemName={data.itemName} />
        ) : null}
      </div>
      <div className="flex items-center gap-3 px-3 py-3">
        <AssetImage kind="items" id={data.itemId} width={48} alt="" loading="eager" />
        {isValidRate ? (
          <FlowNodeOutputRate itemName={data.itemName} baseIpm={rate} />
        ) : (
          <span className="min-w-0 text-sm font-semibold text-foreground">{data.itemName}</span>
        )}
      </div>
      <div className="border-t border-divider/70 bg-content2/45 px-3 py-2 text-xs text-foreground/75">
        <span>{isRawMaterial ? 'External · warehouse / drone' : 'Acquired outside production'}</span>
        {data.supplyAmount !== undefined && <span className="mt-1 block">Configured delivery: {data.supplyAmount}/min</span>}
      </div>
    </FlowNodeShell>
  )
}
