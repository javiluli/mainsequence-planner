import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { BuildingCostSummary, BuildingCostTable, useBuildingCostData } from '@/features/planner/ui/building-cost-diagram'
import { itemNameById } from '@/shared/data'
import { Flex, Typography } from '@/shared/ui'

export function ProductionBuildingCostDiagram() {
  const plan = useProductionPlan()
  const data = useBuildingCostData(plan?.steps)

  if (!data) {
    return (
      <Flex align="center" justify="center" className="h-full min-h-0 p-6">
        <Flex direction="col" align="center" justify="center" className="gap-2 py-12 text-center">
          <Typography tone="soft" className="italic">
            No production buildings required
          </Typography>
          <Typography variant="small" tone="soft">
            This plan uses external inputs only.
          </Typography>
        </Flex>
      </Flex>
    )
  }

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
        <div className="px-4 py-4">
          <BuildingCostTable rows={data.rows} itemNameMap={itemNameById} />

          <div className="mt-6">
            <BuildingCostSummary materials={data.materials} itemNameMap={itemNameById} hasUnknownCosts={data.hasUnknownCosts} />
          </div>
        </div>
      </div>
    </div>
  )
}
