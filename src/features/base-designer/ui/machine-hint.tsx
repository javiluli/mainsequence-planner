import { useLayoutEffect, useRef } from 'react'
import { itemNameById } from '@/shared/data'
import { AssetImage, Typography } from '@/shared/ui'
import type { Scene } from '../model/scene'
import { BUILDINGS } from '../model/buildings'
import { recipeForBuilding } from '../lib/building-recipes'
import { estimatedMachineOutput, type ProductionAnalysis } from '../lib/production-analysis'
import type { HoveredPort } from './port-hint'
import { machineStatus } from './machine-status'
import { productionAmount as amount } from './production-amount'

/** One body hint explains this machine's allocation; it never selects actors or opens network inspection. */
export function MachineHint({ scene, analysis, hover }: { scene: Scene; analysis: ProductionAnalysis; hover: HoveredPort }) {
  const ref = useRef<HTMLDivElement>(null)
  const building = scene.buildings.find((piece) => piece.id === hover.owner.id)
  const machine = analysis.machines.get(hover.owner.id)
  // Measure only on entry/content changes; canvas-owned CSS coordinates follow the pointer without React updates.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const width = element.offsetWidth,
      height = element.offsetHeight
    element.style.left = `clamp(8px, var(--machine-pointer-x, ${hover.x + 16}px), calc(100% - ${width + 8}px))`
    element.style.top = `clamp(8px, var(--machine-pointer-y, ${hover.y + 16}px), calc(100% - ${height + 8}px))`
  }, [hover, machine])
  if (!building || !machine) return null
  const status = machineStatus[machine.state],
    recipe = recipeForBuilding(building.type, building.recipeId),
    inputs = machine.reception?.items ?? machine.inputs,
    reason = machine.reason ?? inputs.find((input) => input.reason)?.reason,
    statusLabel = machine.reception
      ? machine.state === 'ready'
        ? 'Receiving items'
        : machine.state === 'missing-input'
          ? 'No incoming items'
          : status.label
      : status.label
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-20 max-h-[calc(100%-1rem)] w-72 max-w-[calc(100%-1rem)] space-y-2 overflow-hidden rounded-md bg-content1 p-3 shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <Typography as="strong" variant="micro">
          {BUILDINGS[building.type].label}
        </Typography>
        <Typography as="span" variant="caption" className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: status.color }} />
          {statusLabel}
        </Typography>
      </div>
      {recipe && (
        <div className="flex items-center gap-2">
          <AssetImage kind="items" id={recipe.output.id} width={28} alt="" />
          <Typography as="span" variant="caption" className="min-w-0 flex-1">
            {itemNameById.get(recipe.output.id) ?? recipe.output.id}
          </Typography>
          <Typography as="strong" variant="micro" className="shrink-0 text-right tabular-nums">
            {amount(estimatedMachineOutput(machine, recipe.output.amount_per_minute))}/min
            <Typography as="span" variant="caption" tone="muted" className="block">
              estimated
            </Typography>
          </Typography>
        </div>
      )}
      {inputs.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between gap-2">
            <Typography as="span" variant="caption" tone="muted">
              {machine.reception ? 'Incoming · items/min' : 'Inputs · items/min'}
            </Typography>
            {!machine.reception && (
              <Typography as="span" variant="caption" tone="muted">
                Supplied / Needed
              </Typography>
            )}
          </div>
          {inputs.map((input) => (
            <div key={input.itemId} className="flex items-center gap-2">
              <AssetImage kind="items" id={input.itemId} width={22} alt="" />
              <Typography as="span" variant="caption" className="min-w-0 flex-1">
                {itemNameById.get(input.itemId) ?? input.itemId}
              </Typography>
              <Typography as="strong" variant="micro" className="whitespace-nowrap tabular-nums">
                {amount(input.available)}
                {input.demand !== null ? ` / ${amount(input.demand)}` : '/min'}
              </Typography>
            </div>
          ))}
        </div>
      )}
      {machine.unexpectedItems.length > 0 && (
        <Typography variant="caption" className="text-danger">
          Received: {machine.unexpectedItems.map((id) => itemNameById.get(id) ?? id).join(', ')}
        </Typography>
      )}
      {reason && (
        <Typography variant="caption" tone="muted">
          {reason}
        </Typography>
      )}
    </div>
  )
}
