import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { itemNameById } from '@/shared/data'
import { AssetImage, Flex, Typography } from '@/shared/ui'

export function RawTargetDiagram() {
  const plan = useProductionPlan()

  if (!plan) return null

  const targetName = itemNameById.get(plan.targetId) ?? plan.targetId

  return (
    <Flex align="center" justify="center" className="h-full min-h-0 p-6">
      <Flex
        direction="col"
        align="center"
        gap="md"
        className="w-full max-w-xl rounded-xl border border-dashed border-divider/70 p-12 text-center"
      >
        <AssetImage kind="items" id={plan.targetId} alt="" width={96} />
        <Typography as="h2" variant="h2">
          {targetName}
        </Typography>
        <Typography tone="soft">Raw material target</Typography>
        <Typography tone="muted">
          This resource is a terminal input and does not require a production recipe or building. Target: {plan.targetIpm} units/min.
        </Typography>
      </Flex>
    </Flex>
  )
}
