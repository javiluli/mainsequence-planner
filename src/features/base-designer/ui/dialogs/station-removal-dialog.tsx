import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { useId, useMemo, useState } from 'react'
import type { BaseStation } from '../../lib/layout/placement'
import { stationRemovalCheck } from '../../lib/layout/removal'
import { removalBlockerMessage } from '../commands/removal-feedback'

export function StationRemovalDialog({
  stationId,
  stations,
  cutting,
  onRemove,
  onClose,
}: {
  stationId: string
  stations: readonly BaseStation[]
  cutting: boolean
  onRemove: (id: string) => boolean
  onClose: () => void
}) {
  const station = stations.find((candidate) => candidate.id === stationId)
  const check = useMemo(() => stationRemovalCheck(stations, stationId), [stations, stationId])
  const [rejected, setRejected] = useState(false)
  const feedbackId = useId()
  const feedback = !check.allowed
    ? removalBlockerMessage(check.reason)
    : rejected
      ? 'The station could not be removed. Review its connections and try again.'
      : null
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      placement="center"
      classNames={{ base: 'rounded-sm bg-content1' }}
    >
      <ModalContent>
        <ModalHeader>{cutting ? 'Cut station?' : 'Remove station?'}</ModalHeader>
        <ModalBody>
          <p className="text-sm text-foreground/75">
            {check.allowed
              ? `${station?.name ?? 'This station'} and everything placed inside it will be removed from this session.`
              : `${station?.name ?? 'This station'} cannot currently be removed.`}
          </p>
          {cutting ? <p className="text-sm text-foreground/75">They will be copied to the clipboard after removal succeeds.</p> : null}
          {feedback ? (
            <p id={feedbackId} role="alert" className="text-sm text-warning">
              {feedback}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="danger"
            isDisabled={!check.allowed}
            aria-describedby={feedback ? feedbackId : undefined}
            onPress={() => {
              // A preflight rendered earlier cannot authorize a destructive commit against a newer layout.
              if (!onRemove(stationId)) {
                setRejected(true)
                return
              }
              onClose()
            }}
          >
            {cutting ? 'Cut station' : 'Remove station'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
