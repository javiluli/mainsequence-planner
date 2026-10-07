import { useCallback, useMemo, useState } from 'react'
import type { NodeChange } from '@xyflow/react'
import { CELL_SIZE, PLACEABLES, STATION_TYPES } from '../../model/catalog'
import type { StationFlowNode, StationNodeData } from '../../model/station-node'
import type { EditorSelection } from '../../model/editor-selection'
import type { BaseNote, BaseStation } from '../../lib/layout/placement'
import type { WorldPlacement } from '../../lib/layout/world-layout'
import type { NoteFlowNode } from '../nodes/note-node'

/** Common node inputs are memoized by the editor; node-local ownership/highlights are projected below. */
export type CanvasStationData = Pick<
  StationNodeData,
  | 'layoutStations'
  | 'layoutCorridors'
  | 'worldPieces'
  | 'worldPreviewRoute'
  | 'interactionRevision'
  | 'animatedBelts'
  | 'droneSourceCells'
  | 'tool'
  | 'toolDirection'
  | 'selectedRouteId'
  | 'selectedAreaIds'
  | 'selectionPreview'
  | 'pasteActive'
  | 'onActivate'
  | 'onSelectStation'
  | 'onCell'
  | 'onPickTool'
  | 'onStartBelt'
  | 'onOpenMachineItem'
  | 'onClearMachineItem'
  | 'onOpenDroneOutput'
  | 'onClearDroneOutput'
  | 'onAreaSelect'
  | 'onSelectionPreview'
  | 'onClearSelectionPreview'
  | 'onRouteHover'
  | 'onTransformPlacements'
  | 'onToggleStationLock'
  | 'onToggleMachineOutput'
  | 'onOutputCommand'
  | 'onReleaseTool'
  | 'onPlacementGesture'
  | 'onBuildPreviewChange'
  | 'routeDraft'
  | 'routePreviewValid'
>

interface CanvasNodeOptions {
  stations: BaseStation[]
  notes: BaseNote[]
  stationData: CanvasStationData
  neighborsByStation: ReadonlyMap<string, WorldPlacement[]>
  selectedNodeSet: ReadonlySet<string>
  selectedPart: Extract<EditorSelection, { kind: 'part' }> | null
  movementIds: ReadonlySet<string>
  movementValid: boolean
  draggable: boolean
  updateNote: (id: string, text: string) => void
  onNodeSelectionChange: (changes: readonly { id: string; selected: boolean }[]) => void
}

/**
 * Adapt one render snapshot to controlled React Flow nodes, retaining DOM note measurements across previews.
 * React Flow owns viewport/measurement events; selection changes go straight to the explicit selection owner.
 * This hook neither recomputes world geometry nor commits gestures or owns another selection.
 */
export function useCanvasNodes({
  stations,
  notes,
  stationData,
  neighborsByStation,
  selectedNodeSet,
  selectedPart,
  movementIds,
  movementValid,
  draggable,
  updateNote,
  onNodeSelectionChange,
}: CanvasNodeOptions) {
  const [nodeMeasurements, setNodeMeasurements] = useState<ReadonlyMap<string, { width: number; height: number }>>(() => new Map())
  const handleNodesChange = useCallback(
    (changes: NodeChange<StationFlowNode | NoteFlowNode>[]) => {
      const selected = changes.filter((change) => change.type === 'select')
      if (selected.length) onNodeSelectionChange(selected)
      // Controlled nodes must retain DOM measurements across previews; otherwise React Flow hides and remeasures them.
      const measurements = changes.filter((change) => change.type === 'dimensions' && change.dimensions)
      if (!measurements.length) return
      setNodeMeasurements((current) => {
        let next: Map<string, { width: number; height: number }> | undefined
        for (const change of measurements) {
          if (change.type !== 'dimensions' || !change.dimensions) continue
          const previous = current.get(change.id)
          if (previous?.width === change.dimensions.width && previous.height === change.dimensions.height) continue
          next ??= new Map(current)
          next.set(change.id, change.dimensions)
        }
        return next ?? current
      })
    },
    [onNodeSelectionChange],
  )
  const nodes = useMemo<(StationFlowNode | NoteFlowNode)[]>(
    () => [
      ...stations.map((station): StationFlowNode => ({
        id: station.id,
        type: 'station',
        position: station.position,
        measured: {
          width: STATION_TYPES[station.type].footprintCells * CELL_SIZE,
          height: STATION_TYPES[station.type].footprintCells * CELL_SIZE,
        },
        selected: selectedNodeSet.has(station.id),
        data: {
          ...stationData,
          station,
          movementValid: movementIds.has(station.id) ? movementValid : undefined,
          externalPlacements: neighborsByStation.get(station.id) ?? [],
          active: selectedNodeSet.has(station.id),
          selectedPlacementId: selectedPart?.stationId === station.id ? selectedPart.placementId : null,
        },
        draggable,
        selectable: true,
        // Ports straddle the drone edge; adjacent floors must not paint over half of them.
        zIndex:
          station.type === 'drone_station'
            ? 3
            : station.placements.some((piece) => {
                  const footprint = PLACEABLES[piece.type]
                  const size = STATION_TYPES[station.type].footprintCells
                  return piece.x < 0 || piece.y < 0 || piece.x + footprint.width > size || piece.y + footprint.height > size
                })
              ? 2
              : 0,
      })),
      ...notes.map((note): NoteFlowNode => ({
        id: note.id,
        type: 'note',
        position: note.position,
        measured: nodeMeasurements.get(note.id),
        selected: selectedNodeSet.has(note.id),
        data: { text: note.text, selected: selectedNodeSet.has(note.id), onCommit: (text) => updateNote(note.id, text) },
        dragHandle: '.base-note-handle',
        draggable,
        selectable: true,
        zIndex: 8,
      })),
    ],
    [
      stations,
      notes,
      stationData,
      neighborsByStation,
      selectedNodeSet,
      selectedPart,
      movementIds,
      movementValid,
      draggable,
      updateNote,
      nodeMeasurements,
    ],
  )
  return { nodes, onNodesChange: handleNodesChange }
}
