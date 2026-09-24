import { Flex } from '@/shared/ui'
import { PlannerStats } from './planner-stats'
import { TargetItemSelect } from './target-item-select'
import { TargetRateInput } from './target-rate-input'

/** Complete control bar for selecting and inspecting the active production target. */
export const PlannerToolbar = () => (
  <Flex align="center" wrap="wrap" gap="md" className="w-full min-w-0">
    <Flex gap="sm" className="w-full min-w-0 sm:w-auto">
      <TargetItemSelect />
      <TargetRateInput />
    </Flex>
    <PlannerStats />
  </Flex>
)
