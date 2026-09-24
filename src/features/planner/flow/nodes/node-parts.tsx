import { Typography } from '@/shared/ui'
import { cn } from '@heroui/react'
import { Zap } from 'lucide-react'

export function FlowNodeHeader({ title, className }: { title: string; className?: string }) {
  return (
    <Typography as="h3" variant="small" className={cn('min-w-0 text-sm leading-5 font-semibold', className)}>
      {title}
    </Typography>
  )
}

export function FlowNodeStats({ buildingPower }: { buildingPower?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/75">
      <Zap size={12} aria-hidden className="text-warning" />
      {buildingPower === undefined ? 'Power unknown' : `${buildingPower} MW / machine`}
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

export function FlowNodeOutputRate({ itemName, baseIpm }: FlowNodeOutputRateProps) {
  return (
    <div className="min-w-0">
      <Typography as="span" variant="small" className="block truncate text-sm font-semibold" title={itemName}>
        {itemName}
      </Typography>
      <span className="font-mono text-lg leading-6 font-semibold text-foreground tabular-nums">
        {baseIpm.toFixed(1)} <span className="text-[11px] font-medium text-foreground/65">/ min</span>
      </span>
    </div>
  )
}
