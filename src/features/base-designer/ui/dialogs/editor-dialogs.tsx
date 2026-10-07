import type { BaseStation } from '../../lib/layout/placement'
import type { Direction, EditorTool, StationType } from '../../model/catalog'
import type { useEditorDialogs } from './use-editor-dialogs'
import type { useSelectionCommands } from '../commands/use-selection-commands'
import { BuildPaletteModal } from './build-palette-modal'
import { MachinePortsDialog } from './machine-ports-dialog'
import { MachineItemModal } from './machine-item-modal'
import { DroneOutputModal } from './drone-output-modal'
import { StationRemovalDialog } from './station-removal-dialog'

interface EditorDialogsProps {
  dialogs: ReturnType<typeof useEditorDialogs>
  stations: readonly BaseStation[]
  tool: EditorTool
  selectTool: (tool: EditorTool) => void
  add: (type: StationType) => void
  setMachineProduct: (stationId: string, placementId: string, itemId: string | null) => void
  setDroneOutput: (stationId: string, slot: 0 | 1, itemId: string | null) => void
  toggleMachineOutput: (stationId: string, placementId: string, face: Direction, offset: number) => void
  removal: Pick<ReturnType<typeof useSelectionCommands>, 'pendingRemoval' | 'confirmStationRemoval' | 'closeStationRemoval'>
}

/** Compose existing focus scopes without another modal state; Cut/Delete confirmation keeps its command owner. */
export function EditorDialogs({
  dialogs,
  stations,
  tool,
  selectTool,
  add,
  setMachineProduct,
  setDroneOutput,
  toggleMachineOutput,
  removal,
}: EditorDialogsProps) {
  const {
    paletteOpen,
    setPaletteOpen,
    portsModalPlacement,
    portsModalPart,
    machineModalPlacement,
    machineModalPart,
    closeMachineItem,
    droneModalStation,
    activeDroneSlot,
    setActiveDroneSlot,
    closePorts,
    onDroneOpenChange,
  } = dialogs
  const { pendingRemoval, confirmStationRemoval, closeStationRemoval } = removal
  return (
    <>
      <BuildPaletteModal open={paletteOpen} onOpenChange={setPaletteOpen} tool={tool} onSelect={selectTool} onAddStation={add} />
      {portsModalPlacement && portsModalPart ? (
        <MachinePortsDialog
          key={portsModalPlacement.id}
          placement={portsModalPlacement}
          onToggle={(port) => {
            toggleMachineOutput(portsModalPart.stationId, portsModalPart.placementId, port.face, port.offset)
          }}
          onClose={closePorts}
        />
      ) : null}
      {machineModalPlacement && machineModalPart ? (
        <MachineItemModal
          key={machineModalPlacement.id}
          placement={machineModalPlacement}
          stations={stations}
          onClose={closeMachineItem}
          onAssign={(itemId) => {
            setMachineProduct(machineModalPart.stationId, machineModalPart.placementId, itemId)
          }}
        />
      ) : null}
      <DroneOutputModal
        station={droneModalStation}
        activeSlot={activeDroneSlot}
        onSlotChange={setActiveDroneSlot}
        onOpenChange={onDroneOpenChange}
        onAssign={(stationId, slot, itemId) => setDroneOutput(stationId, slot, itemId)}
      />

      {pendingRemoval ? (
        <StationRemovalDialog
          key={pendingRemoval.stationId}
          stationId={pendingRemoval.stationId}
          stations={stations}
          cutting={pendingRemoval.cutting}
          onRemove={confirmStationRemoval}
          onClose={closeStationRemoval}
        />
      ) : null}
    </>
  )
}
