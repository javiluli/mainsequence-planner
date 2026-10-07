import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { Button, Tooltip } from '@heroui/react'
import { PackagePlus, Trash2 } from 'lucide-react'
import { useSupplyRateDialog } from './supply-rate-context'

interface EditSupplyActionProps {
  itemId: string
  itemName: string
  suggestedRate: number
}

/** The same control adds supply and reopens the editor when a delivery already exists. */
export function EditSupplyAction({ itemId, itemName, suggestedRate }: EditSupplyActionProps) {
  const open = useSupplyRateDialog()
  const configuredRate = usePlannerStore((state) => state.supplyCountByItem[itemId])
  if (!open) return null

  const label = `${configuredRate === undefined ? 'Add' : 'Edit'} supply for ${itemName}`

  return (
    <Tooltip content={label} placement="top" closeDelay={0}>
      <Button
        isIconOnly
        size="sm"
        color="primary"
        variant={configuredRate === undefined ? 'light' : 'flat'}
        className="nodrag h-7 min-w-7 w-7 shrink-0"
        aria-label={label}
        onPress={() => open({ itemId, itemName, suggestedRate })}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <PackagePlus size={16} aria-hidden />
      </Button>
    </Tooltip>
  )
}

export function RemoveSupplyAction({ itemId, itemName }: Pick<EditSupplyActionProps, 'itemId' | 'itemName'>) {
  const removeSupply = usePlannerStore(plannerSelectors.removeSupply)
  const label = `Remove supply for ${itemName}`

  return (
    <Tooltip content={label} placement="top" closeDelay={0}>
      <Button
        isIconOnly
        size="sm"
        color="danger"
        variant="light"
        className="nodrag h-7 min-w-7 w-7 shrink-0"
        aria-label={label}
        onPress={() => removeSupply(itemId)}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Trash2 size={15} aria-hidden />
      </Button>
    </Tooltip>
  )
}
