import { Button } from '@heroui/react'
import { Plus } from 'lucide-react'
import { items, itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import type { BaseStation } from '../lib/placement'
import { ItemPickerModal } from './item-picker-modal'

const itemChoices = [...items].sort((first, second) => first.name.localeCompare(second.name))

interface DroneOutputModalProps {
  station: BaseStation | null
  activeSlot: 0 | 1
  onSlotChange: (slot: 0 | 1) => void
  onOpenChange: (open: boolean) => void
  onAssign: (stationId: string, slot: 0 | 1, itemId: string | null) => void
}

export function DroneOutputModal({ station, activeSlot, onSlotChange, onOpenChange, onAssign }: DroneOutputModalProps) {
  const selectedItemId = station?.droneOutputs?.[activeSlot] ?? null

  return (
    <ItemPickerModal
      open={Boolean(station)}
      onOpenChange={onOpenChange}
      title="Drone station outputs"
      description="Each drone delivers one selected item through its own output. Choose a drone, then assign its cargo."
      items={itemChoices}
      selectedItemId={selectedItemId}
      onSelect={(itemId) => {
        if (station) onAssign(station.id, activeSlot, itemId)
      }}
      context={
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Drone outputs">
          {([0, 1] as const).map((slot) => {
            const itemId = station?.droneOutputs?.[slot]
            const itemName = itemId ? (itemNameById.get(itemId) ?? itemId) : 'Unassigned'
            return (
              <Button
                key={slot}
                variant="flat"
                className={`h-16 min-w-0 justify-start gap-3 rounded-sm border px-3 text-left ${
                  activeSlot === slot ? 'border-primary bg-primary/10' : 'border-divider bg-content2 hover:border-primary/60'
                }`}
                aria-pressed={activeSlot === slot}
                onPress={() => onSlotChange(slot)}
                startContent={itemId ? <AssetImage kind="items" id={itemId} width={34} alt="" /> : <Plus size={20} aria-hidden />}
              >
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/65">Drone {slot + 1}</span>
                  <span className="max-w-full truncate text-xs" title={itemName}>
                    {itemName}
                  </span>
                </span>
              </Button>
            )
          })}
        </div>
      }
    />
  )
}
