import { useMemo } from 'react'
import { machineProductItems, recipeForPlaceable } from '../lib/machine-recipes'
import type { BasePlacement } from '../lib/placement'
import { PLACEABLES } from '../model/catalog'
import { ItemPickerModal } from './item-picker-modal'

export function MachineItemModal({
  placement,
  onClose,
  onAssign,
}: {
  placement: BasePlacement
  onClose: () => void
  onAssign: (itemId: string | null) => void
}) {
  const items = useMemo(() => machineProductItems(placement.type), [placement.type])
  const recipe = recipeForPlaceable(placement.type, placement.recipeId)
  return (
    <ItemPickerModal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      closeOnSelect
      title={`${PLACEABLES[placement.type].label} · Product`}
      description="Choose a visual product label. Belts do not affect this selection."
      emptyMessage="No production items for this building in the current game catalog."
      items={items}
      selectedItemId={recipe?.output.id ?? null}
      onSelect={onAssign}
    />
  )
}
