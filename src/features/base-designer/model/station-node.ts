import { type Node } from '@xyflow/react'
import { type BeltFlow } from '../lib/connections'
import { type BasePlacement, type BaseStation } from '../lib/placement'
import { type RouteAnchor, type RouteCell, type RouteDraft } from '../lib/route'
import { type StationCorridor } from '../lib/stations'
import { type WorldPlacement } from '../lib/world-layout'
import { type Direction, type EditorTool, type PlaceableType } from './catalog'

export interface StationNodeData extends Record<string, unknown> {
  station: BaseStation
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
  pastePreview: PastePreview | null
  onPasteHover: (stationId: string, x: number, y: number) => void
  onPasteLeave: (stationId: string) => void
  onPasteCell: (stationId: string, x: number, y: number) => void
  routeDraft: RouteDraft | null
  routePreviewValid: boolean
  onActivate: (stationId: string) => void
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
  onOpenMachineItem: (stationId: string, placementId: string) => void
  onClearMachineItem: (stationId: string, placementId: string) => void
  onAreaSelect: (ids: string[]) => void
  onMoveArea: (ids: readonly string[], dx: number, dy: number) => boolean
  onSelectionPreview: (sourceStationId: string, dx: number, dy: number) => void
  onClearSelectionPreview: () => void
  onRouteHover: (stationId: string, anchor: RouteAnchor) => void
  onMovePlacement: (stationId: string, placementId: string, x: number, y: number) => boolean
  onMoveRoute: (stationId: string, routeId: string, dx: number, dy: number) => boolean
  onToggleStationLock: (firstId: string, secondId: string) => void
  onToggleMachineOutput: (stationId: string, placementId: string, face: Direction, offset: number) => void
  onReleaseTool: () => void
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
}

export interface PastePreview {
  stationId: string
  pieces: readonly BasePlacement[]
  valid: boolean
}
