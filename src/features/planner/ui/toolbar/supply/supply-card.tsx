import { AssetImage } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { Button } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import { memo } from 'react'

interface SupplyCardProps {
  itemId: string
  itemName: string
  value: number
}

export const SupplyCard = memo(({ itemId, itemName, value }: SupplyCardProps) => {
  const removeSupply = usePlannerStore(plannerSelectors.removeSupply)

  return (
    <li className="flex min-w-0 items-center gap-2 px-1 py-1.5">
      <AssetImage kind="items" id={itemId} width={30} alt="" />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={itemName}>
        {itemName}
      </span>

      <span className="shrink-0 text-xs text-foreground/75 tabular-nums" aria-label={`${value.toFixed(1)} ${itemName} per minute`}>
        {value.toFixed(1)}/min
      </span>
      <Button
        isIconOnly
        size="sm"
        color="danger"
        variant="light"
        className="h-7 min-w-7 w-7 shrink-0"
        aria-label={`Remove ${itemName} supply`}
        onPress={() => removeSupply(itemId)}
      >
        <Trash2 size={15} aria-hidden />
      </Button>
    </li>
  )
})
