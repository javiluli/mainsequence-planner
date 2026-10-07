import { useMemo } from 'react'
import { machineProductItems, recipeForPlaceable } from '../../lib/products/machine-recipes'
import { knownMachineInputItems } from '../../lib/products/machine-inputs'
import { itemNameById } from '@/shared/data'
import type { BasePlacement, BaseStation } from '../../lib/layout/placement'
import { PLACEABLES } from '../../model/catalog'
import { ItemPickerModal } from './item-picker-modal'

export function MachineItemModal({
  placement,
  stations,
  onClose,
  onAssign,
}: {
  placement: BasePlacement
  stations: readonly BaseStation[]
  onClose: () => void
  onAssign: (itemId: string | null) => void
}) {
  const inputItems = useMemo(() => knownMachineInputItems(stations, placement.id), [stations, placement.id])
  const items = useMemo(() => machineProductItems(placement.type, inputItems), [placement.type, inputItems])
  const recipe = recipeForPlaceable(placement.type, placement.recipeId)
  return (
    <ItemPickerModal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`${PLACEABLES[placement.type].label} · Product`}
      description={
        inputItems.size
          ? 'Possible recipes using any known connected source. This does not simulate delivery or check every ingredient.'
          : 'No known connected sources. All compatible catalog products are shown.'
      }
      context={
        <div className="space-y-2 text-xs text-foreground/75">
          {inputItems.size ? <p>Known sources: {[...inputItems].map((id) => itemNameById.get(id) ?? id).join(', ')}</p> : null}
          {recipe && !items.some((item) => item.id === recipe.output.id) ? (
            <p className="text-warning">
              Current assignment: {itemNameById.get(recipe.output.id) ?? recipe.output.id}. Kept outside this filter.
            </p>
          ) : null}
        </div>
      }
      emptyMessage={
        inputItems.size
          ? 'No compatible recipes use these known sources. The existing assignment is unchanged.'
          : 'No production items for this building in the current game catalog.'
      }
      items={items}
      selectedItemId={recipe?.output.id ?? null}
      onSelect={onAssign}
    />
  )
}
