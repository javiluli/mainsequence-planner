import { AssetImage, Typography } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { useCallback, useState, type ReactNode } from 'react'
import { SupplyRateDialogContext, type SupplyRateRequest } from './supply-rate-context'

interface ActiveSupplyRate extends SupplyRateRequest {
  initialRate: number
  isEditing: boolean
}

interface SupplyRateModalProps {
  active: ActiveSupplyRate
  onClose: () => void
}

const roundRate = (value: number) => Math.round(value * 10) / 10

/** Keep manual edits at one decimal while still allowing an empty or in-progress decimal input. */
const normalizeRateText = (value: string): string | null => {
  const normalized = value.replace(',', '.')
  if (/^\d*(?:\.\d?)?$/.test(normalized)) return normalized
  const numeric = Number(normalized)
  return Number.isFinite(numeric) && numeric >= 0 ? roundRate(numeric).toFixed(1) : null
}

function SupplyRateModal({ active, onClose }: SupplyRateModalProps) {
  const [rateText, setRateText] = useState(() => roundRate(active.initialRate).toFixed(1))
  const setSupply = usePlannerStore(plannerSelectors.setSupply)
  const rate = Number(rateText)
  const isValidRate = rateText !== '' && Number.isFinite(rate) && rate >= 0.1

  const adjustRate = (delta: number) => {
    setRateText(roundRate(Math.max(0.1, (isValidRate ? rate : 0.1) + delta)).toFixed(1))
  }

  const save = () => {
    if (!isValidRate) return
    setSupply(active.itemId, roundRate(rate))
    onClose()
  }

  return (
    <Modal isOpen size="sm" placement="center" onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader className="border-b border-divider/70 pb-3">
          <Typography as="h2" variant="h3">
            {active.isEditing ? 'Edit continuous supply' : 'Add continuous supply'}
          </Typography>
        </ModalHeader>
        <ModalBody className="gap-3 py-4">
          <div className="flex items-center gap-2.5">
            <AssetImage kind="items" id={active.itemId} width={40} alt="" />
            <Typography as="p" variant="small" className="min-w-0 font-semibold">
              {active.itemName}
            </Typography>
          </div>
          <Typography variant="micro" tone="soft">
            Continuous delivery offsets production demand; stored items do not.
          </Typography>
          <Input
            autoFocus
            label="Delivery rate"
            aria-label={`Continuous supply of ${active.itemName} in items per minute`}
            labelPlacement="outside"
            variant="bordered"
            type="text"
            inputMode="decimal"
            value={rateText}
            onValueChange={(value) => {
              const normalized = normalizeRateText(value)
              if (normalized !== null) setRateText(normalized)
            }}
            onBlur={() => {
              if (isValidRate) setRateText(roundRate(rate).toFixed(1))
            }}
            endContent={<span className="shrink-0 whitespace-nowrap text-xs text-foreground/65">/min</span>}
          />
          <div className="grid grid-cols-4 gap-2" aria-label="Adjust delivery rate">
            {[-10, -1, 1, 10].map((delta) => (
              <Button
                key={delta}
                size="sm"
                variant="flat"
                className="min-w-0 tabular-nums"
                aria-label={`${delta < 0 ? 'Decrease' : 'Increase'} supply by ${Math.abs(delta)}`}
                isDisabled={delta < 0 && (!isValidRate || rate + delta < 0.1)}
                onPress={() => adjustRate(delta)}
              >
                {delta > 0 ? `+${delta}` : delta}
              </Button>
            ))}
          </div>
          {!active.isEditing && (
            <Typography variant="micro" tone="soft">
              Prefilled from full demand: {roundRate(active.suggestedRate).toFixed(1)}/min.
            </Typography>
          )}
        </ModalBody>
        <ModalFooter className="border-t border-divider/70">
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" isDisabled={!isValidRate} onPress={save}>
            {active.isEditing ? 'Save supply' : 'Add supply'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

/** A single rate editor serves every node, instead of mounting one modal per graph card. */
export function SupplyRateDialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveSupplyRate | null>(null)
  const open = useCallback((request: SupplyRateRequest) => {
    const configuredRate = usePlannerStore.getState().supplyCountByItem[request.itemId]
    setActive({
      ...request,
      initialRate: configuredRate ?? request.suggestedRate,
      isEditing: configuredRate !== undefined,
    })
  }, [])

  return (
    <SupplyRateDialogContext.Provider value={open}>
      {children}
      {active ? <SupplyRateModal key={active.itemId} active={active} onClose={() => setActive(null)} /> : null}
    </SupplyRateDialogContext.Provider>
  )
}
