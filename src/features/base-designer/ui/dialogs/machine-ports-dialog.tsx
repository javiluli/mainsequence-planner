import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import type { BasePlacement } from '../../lib/layout/placement'
import { machinePortKey, machinePorts, type MachinePort } from '../../lib/connections/ports'
import { PLACEABLES, type Direction } from '../../model/catalog'

const faceLabels: Record<Direction, string> = { north: 'North', east: 'East', south: 'South', west: 'West' }

/** Permissions come from the confirmed placement; this dialog never stores another copy of port state. */
export function MachinePortsDialog({
  placement,
  onToggle,
  onClose,
}: {
  placement: BasePlacement
  onToggle: (port: MachinePort) => void
  onClose: () => void
}) {
  const ports = machinePorts(placement)
  const faces = [...new Set(ports.map((port) => port.face))]
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      placement="center"
      scrollBehavior="inside"
      classNames={{ base: 'rounded-sm bg-content1' }}
    >
      <ModalContent>
        <ModalHeader>{PLACEABLES[placement.type].label} · Outputs</ModalHeader>
        <ModalBody>
          <p className="text-sm text-foreground/75">
            Toggle output permission at each opening. Incoming belts remain accepted, including at disabled outputs.
          </p>
          <p className="text-xs text-foreground/65">
            Cells count from left to right on north/south faces and top to bottom on east/west faces, starting at 1.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {faces.map((face) => (
              <fieldset key={face} className="min-w-0 space-y-1.5">
                <legend className="mb-1 text-xs font-medium">{faceLabels[face]}</legend>
                {ports
                  .filter((port) => port.face === face)
                  .map((port) => {
                    const key = machinePortKey(port)
                    const enabled = !placement.disabledOutputPorts?.includes(key)
                    return (
                      <Button
                        key={key}
                        size="sm"
                        variant="flat"
                        color={enabled ? 'primary' : 'default'}
                        className="w-full justify-between rounded-sm"
                        aria-label={`${faceLabels[face]} cell ${port.offset + 1} output`}
                        aria-pressed={enabled}
                        onPress={() => onToggle(port)}
                      >
                        <span>Cell {port.offset + 1}</span>
                        <span>{enabled ? 'Enabled' : 'Disabled'}</span>
                      </Button>
                    )
                  })}
              </fieldset>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
