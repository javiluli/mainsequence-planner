import { Flex } from '@/shared/ui'
import { LayoutGrid } from 'lucide-react'
import { Link } from 'react-router-dom'
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
    <Link
      to="/bases?compare=planner"
      className="ml-auto inline-flex h-8 items-center gap-1.5 border border-divider px-2.5 text-xs font-medium text-foreground/75 transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      title="Compare the current production plan with your base layout"
    >
      <LayoutGrid size={14} aria-hidden />
      Compare in Bases
    </Link>
  </Flex>
)
