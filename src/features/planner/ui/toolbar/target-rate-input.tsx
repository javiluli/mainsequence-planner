import { usePlannerTarget } from '@/features/planner/hooks/use-planner-target'
import { Typography } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { NumberInput } from '@heroui/react'

export const TargetRateInput = () => {
  const targetId = usePlannerStore(plannerSelectors.targetId)
  const targetIpm = usePlannerStore(plannerSelectors.targetIpm)
  const { setTargetRate } = usePlannerTarget()
  const hasTarget = Boolean(targetId)

  return (
    <NumberInput
      aria-label="Target production per minute"
      size="sm"
      variant="faded"
      className="w-24 shrink-0 sm:w-28"
      isDisabled={!hasTarget}
      minValue={hasTarget ? 1 : 0}
      value={hasTarget ? targetIpm : 0}
      onValueChange={setTargetRate}
      endContent={
        <div className="pointer-events-none flex items-center">
          <Typography as="span" variant="micro" tone="soft">
            /
          </Typography>
          <Typography as="span" variant="micro" tone="soft">
            min
          </Typography>
        </div>
      }
    />
  )
}
