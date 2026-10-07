import { type Node } from '@xyflow/react'
import { type BeltFlow } from '../lib/connections/belt-flow'
import { type QuarterTurn } from '../lib/layout/layout-transform'
import { type BasePlacement, type BaseStation } from '../lib/layout/placement'
import { type RouteAnchor, type RouteCell, type RouteDraft } from '../lib/routes/route'
import { type StationCorridor } from '../lib/layout/stations'
import { type WorldPlacement } from '../lib/layout/world-layout'
import { type Direction, type EditorTool, type PlaceableType } from './catalog'

/** Only the active local gesture exposes controls; its proposal and pointer capture remain owned by the station hook. */
export interface PlacementGestureControls {
  canRotate: boolean
  rotate: (turn: QuarterTurn) => boolean
  cancel: () => void
}

export interface StationNodeData extends Record<string, unknown> {
  station: BaseStation
  movementValid?: boolean
  toolDirection?: Direction
  layoutStations: BaseStation[]
  layoutCorridors: readonly StationCorridor[]
  worldPieces: readonly WorldPlacement[]
  worldPreviewRoute: readonly RoutePreviewCell[]
  interactionRevision: number
  externalPlacements: WorldPlacement[]
  animatedBelts: ReadonlyMap<string, readonly BeltFlow[]>
  droneSourceCells: ReadonlySet<string>
  tool: EditorTool
  active: boolean
  selectedPlacementId: string | null
  selectedRouteId: string | null
  selectedAreaIds: ReadonlySet<string>
  selectionPreview: SelectionPreview | null
  pasteActive: boolean
  routeDraft: RouteDraft | null
  routePreviewValid: boolean
  onActivate: (stationId: string) => void
  onSelectStation: (stationId: string, additive: boolean) => void
  onCell: (
    stationId: string,
    x: number,
    y: number,
    direction?: Direction,
    portFace?: Direction,
    portRole?: 'input' | 'output',
    portRouteId?: string,
    mergeTargetId?: string,
  ) => void
  onPickTool: (type: PlaceableType) => void
  onStartBelt?: (stationId: string, anchor: Extract<RouteAnchor, { kind: 'port' }>) => void
  onOpenDroneOutput: (stationId: string, slot: 0 | 1) => void
  onClearDroneOutput?: (stationId: string, slot: 0 | 1) => void
  onOpenMachineItem: (stationId: string, placementId: string) => void
  onClearMachineItem: (stationId: string, placementId: string) => void
  onAreaSelect: (ids: string[]) => void
  onSelectionPreview: (sourceStationId: string, dx: number, dy: number, turns?: number) => void
  onClearSelectionPreview: () => void
  onRouteHover: (stationId: string, anchor: RouteAnchor) => void
  onTransformPlacements: (proposal: readonly BasePlacement[]) => boolean
  onToggleStationLock: (firstId: string, secondId: string) => void
  onToggleMachineOutput: (stationId: string, placementId: string, face: Direction, offset: number) => void
  onReleaseTool: () => void
  onOutputCommand?: (execute: () => void) => () => void
  onPlacementGesture?: (gesture: PlacementGestureControls) => () => void
  onBuildPreviewChange?: (stationId: string, active: boolean) => void
}

export type StationFlowNode = Node<StationNodeData, 'station'>

export interface RoutePreviewCell extends RouteCell {
  buried: boolean
  routeIndex: number
}

export interface SelectionPreview {
  sourceStationId: string
  dx: number
  dy: number
  valid: boolean
  turns?: number
}
