import { Flex } from '@/shared/ui'
import { LayoutGrid } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@heroui/react'
import { PlannerStats } from './planner-stats'
import { TargetItemSelect } from './target-item-select'
import { TargetRateInput } from './target-rate-input'
import { RecipeOptionsPopover } from './recipe-options-popover'
import { SupplyPopover } from './supply/supply-popover'

/** Complete control bar for selecting and inspecting the active production target. */
export const PlannerToolbar = () => (
  <Flex align="center" wrap="wrap" gap="md" className="w-full min-w-0">
    <Flex gap="sm" className="w-full min-w-0 sm:w-auto">
      <TargetItemSelect />
      <TargetRateInput />
    </Flex>
    <PlannerStats />

    <SupplyPopover />
    <RecipeOptionsPopover />
    <Button
      as={Link}
      role="link"
      to="/bases?compare=planner"
      size="sm"
      color="primary"
      variant="bordered"
      startContent={<LayoutGrid size={14} aria-hidden />}
      className="ml-auto shrink-0"
      title="Compare the current production plan with your base layout"
    >
      Compare in Bases
    </Button>
  </Flex>
)
