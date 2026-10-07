import type { StoreApi } from 'zustand'
import type { BaseNote, BasePlacement, BaseStation } from '@/features/base-designer/lib/layout/placement'
import type { Direction, PlaceableType, RouteTool, StationType } from '@/features/base-designer/model/catalog'
import type { BeltJunction, RouteCell } from '@/features/base-designer/lib/routes/route'
import type { LayoutClipboard } from '@/features/base-designer/lib/clipboard/clipboard'
import type { BaseLayoutDocument } from '@/features/base-designer/lib/layout/layout-document'
import type { BaseStorageIssue } from './persistence'

export interface BaseDesignerState {
  storageIssue: BaseStorageIssue
  stations: BaseStation[]
  notes: BaseNote[]
  past: BaseDesignerSnapshot[]
  future: BaseDesignerSnapshot[]
  addNote: (position: { x: number; y: number }) => string
  updateNote: (id: string, text: string) => void
  removeNote: (id: string) => void
  addStation: (type: StationType, position: BaseStation['position'], direction?: Direction) => string | null
  rotateStation: (id: string) => boolean
  commitLayoutMove: (stations: BaseStation[], notes: BaseNote[]) => boolean
  transformPlacements: (proposal: readonly BasePlacement[]) => boolean
  undo: () => void
  redo: () => void
  assignRecipe: (stationId: string, placementId: string, recipeId: string | null) => boolean
  setMachineProduct: (stationId: string, placementId: string, itemId: string | null) => boolean
  toggleMachineOutput: (stationId: string, placementId: string, face: Direction, offset: number) => boolean
  setDroneOutput: (stationId: string, slot: 0 | 1, itemId: string | null) => boolean
  toggleStationLock: (firstId: string, secondId: string) => void
  removeStation: (id: string) => boolean
  pasteLayout: (proposal: LayoutClipboard) => string[] | null
  pastePlacements: (stationId: string, source: readonly BasePlacement[], worldCursor: { x: number; y: number }) => string | null
  place: (stationId: string, type: PlaceableType, x: number, y: number, direction?: Direction) => boolean
  placeRoute: (
    stationId: string,
    type: RouteTool,
    cells: readonly RouteCell[],
    mergeRouteIds?: readonly string[],
    junction?: BeltJunction,
  ) => boolean
  movePlacement: (stationId: string, placementId: string, x: number, y: number) => boolean
  moveRoute: (stationId: string, routeId: string, dx: number, dy: number) => boolean
  rotateAt: (stationId: string, x: number, y: number) => void
  removePlacements: (ids: readonly string[]) => void
  movePlacements: (ids: readonly string[], dx: number, dy: number) => boolean
}

export type BaseDesignerSnapshot = BaseLayoutDocument

/** Store adapter dependencies only; proposal validation stays in feature domain modules. */
export interface BaseStoreContext {
  set: StoreApi<BaseDesignerState>['setState']
  get: StoreApi<BaseDesignerState>['getState']
  makeId: () => string
}
