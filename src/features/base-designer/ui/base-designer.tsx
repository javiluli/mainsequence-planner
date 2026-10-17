import { Button, Tooltip } from '@heroui/react'
import type Konva from 'konva'
import { Trash2, Scissors, Copy, ClipboardPaste, RotateCw, Undo2, Redo2, Package } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import { EditorPalette } from './editor-palette'
import { EditorCanvas } from './canvas/editor-canvas'
import { useEditorTools } from './tools/use-editor-tools'
import { DroneCargoDialog } from './drone-cargo-dialog'
import { MachineRecipeDialog } from './machine-recipe-dialog'
import { recipesForBuilding } from '../lib/building-recipes'
import { beltNetwork } from '../lib/belt-network'
import { PortHint, type HoveredPort } from './port-hint'
import { portsForSelection } from '../lib/output-ports'
import type { ProductionPlan } from '@/features/planner'
import { analyzeProduction } from '../lib/production-analysis'
import { ProductionInfo } from './production-info'
import { MachineHint } from './machine-hint'

const storageMessages = {
  unavailable: 'Local storage is unavailable. Changes will be lost on reload.',
  unreadable: 'The saved scene cannot be read. It is preserved; changes in this session will not be saved.',
  'write-failed': 'Changes could not be saved locally. Keep this page open and retry.',
  conflict: 'The saved scene changed in another tab. This session will not overwrite it; reload to open that scene.',
} as const

/** HeroUI controls the app shell; the canvas and tool owner keep confirmed and transient state separate. */
export function BaseDesigner({
  referencePlan,
  comparisonRequested = false,
}: {
  referencePlan?: ProductionPlan | null
  comparisonRequested?: boolean
}) {
  const scene = useBaseDesignerStore()
  const network = useMemo(
    () =>
      beltNetwork({
        belts: scene.belts,
        buildings: scene.buildings,
        stations: scene.stations,
        splitters: scene.splitters,
        tunnels: scene.tunnels,
      }),
    [scene.belts, scene.buildings, scene.stations, scene.splitters, scene.tunnels],
  )
  const [hoverPort, setHoverPort] = useState<HoveredPort | null>(null)
  const analysis = useMemo(() => analyzeProduction(scene, network), [scene, network])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [productionOpen, setProductionOpen] = useState(comparisonRequested)
  const [cargoTarget, setCargoTarget] = useState<{ stationId: string; slot: 0 | 1 } | null>(null)
  const [recipeTarget, setRecipeTarget] = useState<string | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null),
    containerRef = useRef<HTMLDivElement | null>(null)
  const tools = useEditorTools(stageRef, containerRef)
  const removalBlocked = tools.selections.length > 0 && !tools.removable
  const cargoStation = scene.stations.find((station) => station.id === cargoTarget?.stationId && station.type === 'drone')
  const selectedStation = scene.stations.find((station) => station.id === tools.selection?.id && tools.selection?.kind === 'station')
  const selectedDrone = selectedStation?.type === 'drone' ? selectedStation : undefined
  const recipeBuilding = scene.buildings.find((building) => building.id === recipeTarget && recipesForBuilding(building.type).length)
  // Forget removed editing context immediately, so undo cannot reopen its old dialog.
  if (cargoTarget && !cargoStation) setCargoTarget(null)
  if (recipeTarget && !recipeBuilding) setRecipeTarget(null)
  /** Opening protected cargo context cancels native gestures before a modal takes focus. */
  const openCargo = (stationId: string, slot: 0 | 1) => {
    tools.chooseTool({ kind: 'select' })
    tools.setSelection({ kind: 'station', id: stationId })
    setRecipeTarget(null)
    setHoverPort(null)
    setCargoTarget({ stationId, slot })
  }
  const closeCargo = () => {
    setCargoTarget(null)
    requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }))
  }
  /** Recipe editing cancels canvas gestures and owns focus until assignment or dismissal. */
  const openRecipe = (buildingId: string) => {
    const building = useBaseDesignerStore.getState().buildings.find((item) => item.id === buildingId)
    if (!building || !recipesForBuilding(building.type).length) return
    tools.chooseTool({ kind: 'select' })
    tools.setSelection({ kind: 'building', id: buildingId })
    setCargoTarget(null)
    setHoverPort(null)
    containerRef.current?.blur()
    setRecipeTarget(buildingId)
  }
  const closeRecipe = () => {
    setRecipeTarget(null)
    requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }))
  }
  return (
    <section
      aria-label="Base designer"
      className="flex min-h-0 flex-1 flex-col"
      onKeyDownCapture={(event) => {
        // Tooltip triggers consume Escape during bubbling; editor commands run first outside dialogs and fields.
        if (catalogOpen || cargoStation || recipeBuilding) return
        if (event.target instanceof HTMLElement && event.target.closest('#base-production-panel')) return
        if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
        const modifier = event.ctrlKey || event.metaKey
        if (event.key === 'Escape') {
          event.preventDefault()
          tools.escape()
        } else if (modifier && event.key.toLowerCase() === 'a') {
          event.preventDefault()
          tools.selectAll(event.shiftKey)
        } else if (
          !modifier &&
          !event.altKey &&
          tools.tool.kind === 'select' &&
          tools.selections.length &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
        ) {
          event.preventDefault()
          tools.nudge({
            x: event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0,
            y: event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0,
          })
        } else if (event.key === 'Delete' && tools.selections.length) {
          event.preventDefault()
          tools.remove()
        } else if (modifier && !event.altKey && event.key.toLowerCase() === 'z') {
          event.preventDefault()
          tools.restoreHistory(event.shiftKey ? 'redo' : 'undo')
        } else if (modifier && event.key.toLowerCase() === 'c') {
          event.preventDefault()
          tools.copy()
        } else if (modifier && event.key.toLowerCase() === 'x') {
          event.preventDefault()
          tools.remove(true)
        } else if (modifier && event.key.toLowerCase() === 'v') {
          event.preventDefault()
          if (tools.clipboard) tools.chooseTool({ kind: 'place', item: tools.clipboard })
        } else if (!modifier && event.key.toLowerCase() === 'r' && tools.rotatable) {
          // Holding R intentionally applies successive turns; C/F use one action per key press instead.
          event.preventDefault()
          tools.rotate()
        }
      }}
    >
      {scene.storageIssue && (
        <div role="alert" className="flex items-center gap-3 border-b border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <span className="min-w-0 flex-1">{storageMessages[scene.storageIssue]}</span>
          {scene.storageIssue === 'write-failed' && (
            <Button size="sm" color="danger" variant="flat" onPress={scene.retrySave}>
              Retry save
            </Button>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <EditorPalette
          tool={tools.tool}
          isOpen={catalogOpen}
          onOpenChange={setCatalogOpen}
          onChoose={tools.chooseTool}
          productionOpen={productionOpen}
          onProductionToggle={() => setProductionOpen((open) => !open)}
        />
        <EditorCanvas
          scene={scene}
          network={network}
          analysis={analysis}
          tools={tools}
          stageRef={stageRef}
          containerRef={containerRef}
          onOpenCargo={openCargo}
          onOpenRecipe={openRecipe}
          onHoverPort={setHoverPort}
          portHint={
            hoverPort?.owner.kind === 'building' && hoverPort.key === 'body' ? (
              <MachineHint scene={scene} analysis={analysis} hover={hoverPort} />
            ) : (
              <PortHint scene={scene} network={network} hover={hoverPort} />
            )
          }
          details={
            productionOpen && (
              <ProductionInfo
                scene={scene}
                analysis={analysis}
                plan={referencePlan}
                comparisonRequested={comparisonRequested}
                onClose={() => {
                  setProductionOpen(false)
                  requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }))
                }}
              />
            )
          }
          onTogglePort={(target, key) => {
            const current = useBaseDesignerStore.getState(),
              port = portsForSelection(current, target).find((candidate) => candidate.outputKey === key)
            if (port) current.setPortOutput(target, key, port.outputEnabled === false)
          }}
          commands={
            <>
              {selectedDrone && (
                <Tooltip content="Configure drone cargo">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Configure drone cargo"
                    onPress={() => openCargo(selectedDrone.id, 0)}
                  >
                    <Package size={16} aria-hidden />
                  </Button>
                </Tooltip>
              )}
              <Tooltip content="Undo (Ctrl+Z)">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Undo"
                  isDisabled={!scene.past.length}
                  onPress={() => tools.restoreHistory('undo')}
                >
                  <Undo2 size={16} aria-hidden />
                </Button>
              </Tooltip>
              <Tooltip content="Redo (Ctrl+Shift+Z)">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Redo"
                  isDisabled={!scene.future.length}
                  onPress={() => tools.restoreHistory('redo')}
                >
                  <Redo2 size={16} aria-hidden />
                </Button>
              </Tooltip>
              <Tooltip content="Copy selected elements only (Ctrl+C). Unselected station contents and connected routes are not added.">
                <Button isIconOnly size="sm" variant="light" aria-label="Copy" isDisabled={!tools.copyable} onPress={tools.copy}>
                  <Copy size={16} aria-hidden />
                </Button>
              </Tooltip>
              <Tooltip content={removalBlocked ? 'Include every piece that would lose floor support.' : 'Cut (Ctrl+X)'}>
                <span
                  className="inline-flex rounded outline-none focus-visible:ring-2 focus-visible:ring-warning"
                  tabIndex={removalBlocked ? 0 : undefined}
                  aria-label={removalBlocked ? 'Cut unavailable' : undefined}
                >
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Cut"
                    isDisabled={!tools.removable}
                    onPress={() => tools.remove(true)}
                  >
                    <Scissors size={16} aria-hidden />
                  </Button>
                </span>
              </Tooltip>
              <Tooltip content="Paste (Ctrl+V)">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Paste"
                  isDisabled={!tools.clipboard}
                  onPress={() => tools.clipboard && tools.chooseTool({ kind: 'place', item: tools.clipboard })}
                >
                  <ClipboardPaste size={16} aria-hidden />
                </Button>
              </Tooltip>
              <Tooltip content="Rotate (R)">
                <Button isIconOnly size="sm" variant="light" aria-label="Rotate" isDisabled={!tools.rotatable} onPress={tools.rotate}>
                  <RotateCw size={16} aria-hidden />
                </Button>
              </Tooltip>
              <Tooltip content={removalBlocked ? 'Include every piece that would lose floor support.' : 'Delete (Delete)'}>
                <span
                  className="inline-flex rounded outline-none focus-visible:ring-2 focus-visible:ring-warning"
                  tabIndex={removalBlocked ? 0 : undefined}
                  aria-label={removalBlocked ? 'Delete unavailable' : undefined}
                >
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Delete"
                    isDisabled={!tools.removable}
                    onPress={() => tools.remove()}
                  >
                    <Trash2 size={16} aria-hidden />
                  </Button>
                </span>
              </Tooltip>
            </>
          }
        />
      </div>
      {cargoStation?.type === 'drone' && cargoTarget && (
        <DroneCargoDialog
          station={cargoStation}
          slot={cargoTarget.slot}
          onSlotChange={(slot) => setCargoTarget({ stationId: cargoStation.id, slot })}
          onChoose={(id) => {
            scene.setDroneCargo(cargoStation.id, cargoTarget.slot, id)
            closeCargo()
          }}
          onClose={closeCargo}
        />
      )}
      {recipeBuilding && (
        <MachineRecipeDialog
          key={recipeBuilding.id}
          building={recipeBuilding}
          onClose={closeRecipe}
          onChoose={(recipeId) => {
            const current = useBaseDesignerStore.getState(),
              building = current.buildings.find((item) => item.id === recipeBuilding.id)
            if (building && ((building.recipeId ?? null) === recipeId || current.setBuildingRecipe(building.id, recipeId))) closeRecipe()
          }}
        />
      )}
    </section>
  )
}
