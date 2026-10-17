import { AssetImage } from '@/shared/ui'
import { items } from '@/shared/data'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { Autocomplete, AutocompleteItem } from '@heroui/react'
import { usePlannerTarget } from '@/features/planner/hooks/use-planner-target'

/** Selects a catalog target and exposes an accessible reset without changing recipe policy. */
export function TargetItemSelect() {
  const targetId = usePlannerStore(plannerSelectors.targetId)
  const { selectTargetItem } = usePlannerTarget()

  return (
    <Autocomplete
      aria-label="Select production target"
      size="sm"
      variant="faded"
      color="primary"
      className="min-w-0 flex-1 sm:w-64 sm:flex-none"
      placeholder="Select an item"
      maxListboxHeight={600}
      clearButtonProps={{ 'aria-label': 'Clear production target' }}
      selectedKey={targetId}
      onSelectionChange={(id) => selectTargetItem(typeof id === 'string' ? id : '')}
    >
      {items.map((i) => (
        <AutocompleteItem key={i.id} textValue={i.name} startContent={<AssetImage kind="items" id={i.id} width={32} alt="" />}>
          {i.name}
        </AutocompleteItem>
      ))}
    </Autocomplete>
  )
}
