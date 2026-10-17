import type { ReactNode } from 'react'
import type { ProductionNodeData } from '@/features/planner/flow/types'
import { AssetImage } from '@/shared/ui'
import { FlowNodeShell } from './flow-node-shell'
import { FlowNodeCountBadge, FlowNodeHeader, FlowNodeStats } from './node-parts'
import { EditSupplyAction } from '@/features/planner/ui/supply/supply-node-actions'

interface ProductionNodeCardProps {
  children?: ReactNode
  data: ProductionNodeData
  selected?: boolean
}

/** Keep the physical machine and the requested product distinct without implying adjustable speed. */
export function ProductionNodeCard({ children, data, selected = false }: ProductionNodeCardProps) {
  const { buildingId, buildingName, buildingPower, buildingCount, itemId, itemName, baseIpm, targetIpm, recycledIpm, extraOutputs } = data

  return (
    <FlowNodeShell selected={selected}>
      {children}

      <div className="flex items-center gap-2.5 border-b border-divider/70 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <FlowNodeHeader title={buildingName} className="truncate" />
          <FlowNodeStats buildingPower={buildingPower} />
        </div>
        <EditSupplyAction itemId={itemId} itemName={itemName} suggestedRate={targetIpm} />
        <FlowNodeCountBadge buildingCount={buildingCount} />
      </div>

      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 px-3 py-2.5">
        <AssetImage kind="buildings" id={buildingId} width={96} alt="" loading="eager" />
        <div className="flex min-h-24 min-w-0 flex-col justify-between py-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <AssetImage kind="items" id={itemId} width={32} alt="" loading="eager" />
            <span className="line-clamp-2 min-w-0 wrap-break-word text-xs leading-tight font-medium text-foreground/80" title={itemName}>
              {itemName}
            </span>
          </div>
          <div
            className="whitespace-nowrap font-mono text-xl leading-7 font-semibold text-foreground tabular-nums"
            aria-label={`${targetIpm.toFixed(1)} ${itemName} required per minute`}
          >
            {targetIpm.toFixed(1)} <span className="text-xs font-medium text-foreground/70">/min</span>
          </div>
          <span className="text-[11px] leading-4 text-foreground/70 tabular-nums" title="Nominal production rate per machine">
            Nominal {baseIpm.toFixed(1)}/min
          </span>
        </div>
      </div>

      {recycledIpm !== undefined || extraOutputs?.length ? (
        <div className="space-y-1 border-t border-divider/70 px-3 py-2 text-xs leading-4 text-foreground/75">
          {recycledIpm !== undefined ? <p>Internal recycle: {recycledIpm.toFixed(1)}/min · net output shown</p> : null}
          {extraOutputs?.map((output) => (
            <p key={output.id}>
              Byproduct: {output.name} {output.amount_per_minute.toFixed(1)}/min
            </p>
          ))}
        </div>
      ) : null}
    </FlowNodeShell>
  )
}
