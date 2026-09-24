import type { ReactNode } from 'react'
import { Flex, Typography } from '@/shared/ui'
import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { Divider, Tooltip } from '@heroui/react'
import { Factory, Zap } from 'lucide-react'

interface PlannerStatProps {
  icon: ReactNode
  value: string | number
  tooltip: string
}

const PlannerStat = ({ icon, value, tooltip }: PlannerStatProps) => (
  <Tooltip content={tooltip} showArrow delay={250} closeDelay={0}>
    <Flex
      as="span"
      tabIndex={0}
      aria-label={`${tooltip}: ${value}`}
      className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {icon}
      <Typography as="span" className="font-mono tabular-nums">
        {value}
      </Typography>
    </Flex>
  </Tooltip>
)

/** Compact summary of the resources required by the active production plan. */
export const PlannerStats = () => {
  const plan = useProductionPlan()

  if (plan?.issues.length) {
    return (
      <Typography as="span" variant="small" tone="soft">
        Production totals unavailable
      </Typography>
    )
  }

  const { buildings = 0, power = 0 } = plan?.stats ?? {}
  const powerLabel = power === null ? 'Unknown' : `${power} MW`

  return (
    <Flex className="h-5 px-0 sm:px-3" gap="sm">
      <PlannerStat icon={<Factory aria-hidden size={18} />} value={buildings} tooltip="Production buildings required" />
      <Divider orientation="vertical" className="bg-foreground/60" />
      <PlannerStat icon={<Zap aria-hidden size={18} />} value={powerLabel} tooltip="Total power consumption (MW)" />
    </Flex>
  )
}
