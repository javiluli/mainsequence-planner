import { getSupplyCountItemIds } from '@/features/planner/lib/supply-count'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { Button, Chip, Popover, PopoverContent, PopoverTrigger } from '@heroui/react'
import { ChevronDown } from 'lucide-react'
import { SupplyPanel } from './supply-panel'

export const SupplyPopover = () => {
  const supplyCountByItem = usePlannerStore(plannerSelectors.supplyCountByItem)
  const supplyItemIds = getSupplyCountItemIds(supplyCountByItem)
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button size="sm" variant="light" aria-label={`Supply: ${supplyItemIds.length} continuous delivery items configured`}>
          <span>Supply</span>
          <Chip
            size="sm"
            variant="flat"
            color={supplyItemIds.length ? 'primary' : 'default'}
            className="h-5 min-w-5 px-1 text-[11px] tabular-nums"
          >
            {supplyItemIds.length}
          </Chip>
          <ChevronDown size={16} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <div className="max-h-[70vh] w-full overflow-y-auto p-2.5">
          <SupplyPanel supplyCountByItem={supplyCountByItem} supplyItemIds={supplyItemIds} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
