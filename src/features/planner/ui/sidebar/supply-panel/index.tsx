import { getSupplyCountItemIds } from '@/features/planner/lib/supply-count'
import { itemNameById } from '@/shared/data'
import { Flex, Typography } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { SupplyModal } from './supply-modal'
import { SupplyCard } from './supply-card'

export const SupplyPanel = () => {
  const supplyCountByItem = usePlannerStore(plannerSelectors.supplyCountByItem)
  const supplyItemIds = getSupplyCountItemIds(supplyCountByItem)

  return (
    <Flex direction="col" align="stretch" gap="md" className="h-full min-h-0 overflow-hidden px-3 py-2">
      <div className="shrink-0 space-y-2">
        <Typography variant="small" tone="soft">
          Set a continuous delivery rate in items/min from ships, warehouses or drones. Stored items are not a permanent supply rate.
        </Typography>
        <SupplyModal />
      </div>

      {supplyItemIds.length ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Flex direction="col" align="stretch" gap="sm">
            {supplyItemIds.map((id) => (
              <SupplyCard key={id} itemId={id} itemName={itemNameById.get(id) ?? id.replaceAll('_', ' ')} value={supplyCountByItem[id]} />
            ))}
          </Flex>
        </div>
      ) : (
        <Flex direction="col" justify="center" gap="xs" className="min-h-0 flex-1 px-4 pb-10 text-center">
          <Typography variant="small" tone="muted">
            No continuous deliveries configured
          </Typography>
          <Typography variant="small" tone="soft">
            Add an item with a rate in items/min. One-time warehouse stock cannot sustain a factory indefinitely.
          </Typography>
        </Flex>
      )}
    </Flex>
  )
}
