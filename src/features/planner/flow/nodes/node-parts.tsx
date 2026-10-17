import { Typography } from '@/shared/ui'
import { cn } from '@heroui/react'
import { Zap } from 'lucide-react'

/** Keeps machine headings consistent while leaving graph layout and truncation with each node. */
export function FlowNodeHeader({ title, className }: { title: string; className?: string }) {
  return (
    <Typography as="h3" variant="label" className={cn('min-w-0', className)}>
      {title}
    </Typography>
  )
}

export function FlowNodeStats({ buildingPower }: { buildingPower?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/75">
      <Zap size={12} aria-hidden className="text-warning" />
      {buildingPower === undefined ? 'Energy use unknown' : `${buildingPower} MJ / machine`}
    </span>
  )
}

interface FlowNodeCountBadgeProps {
  buildingCount: number
}

export function FlowNodeCountBadge({ buildingCount }: FlowNodeCountBadgeProps) {
  return (
    <span
      className="shrink-0 rounded-sm border border-divider bg-content3 px-2 py-1 text-xs font-semibold text-foreground"
      aria-label={`${buildingCount} ${buildingCount === 1 ? 'machine' : 'machines'}`}
    >
      {buildingCount}×
    </span>
  )
}

interface FlowNodeOutputRateProps {
  itemName: string
  baseIpm: number
}

/** Pairs an output name with its nominal rate; graph-specific numeric typography remains local. */
export function FlowNodeOutputRate({ itemName, baseIpm }: FlowNodeOutputRateProps) {
  return (
    <div className="min-w-0">
      <Typography as="span" variant="label" className="block truncate" title={itemName}>
        {itemName}
      </Typography>
      <span className="font-mono text-lg leading-6 font-semibold text-foreground tabular-nums">
        {baseIpm.toFixed(1)} <span className="text-[11px] font-medium text-foreground/65">/ min</span>
      </span>
    </div>
  )
}
