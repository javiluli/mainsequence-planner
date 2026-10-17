import { nextRotation } from '../model/buildings'
import type { Splitter, Tunnel } from '../model/logistics'
import { canPlaceStation, type Belt, type Point, type Scene, type Selection, type StationTemplate } from '../model/scene'
import {
  alignSplitter,
  canPlaceSplitter,
  buildingPlacementIssue,
  beltPlacementIssue,
  tunnelPlacementIssue,
  isStationEmpty,
  stationAt,
} from './placement'
import type { Building } from '../model/buildings'
import { snapStation } from './stations'
import { rotateGroup, selectionPivot } from './scene-geometry'

/** Session clipboard holds one independent object, without persisted identities or station ownership. */
export type IndividualClipboardItem =
  | ({ kind: 'station' } & StationTemplate)
  | ({ kind: 'building' } & Pick<Building, 'type' | 'rotation' | 'recipeId' | 'disabledOutputs'>)
  | ({ kind: 'belt' } & Omit<Belt, 'id'>)
  | ({ kind: 'splitter' } & Pick<Splitter, 'type' | 'rotation' | 'disabledOutputs'>)
  | ({ kind: 'tunnel' } & Omit<Tunnel, 'id'>)

/** Group snapshots retain local ownership keys; pasting allocates new IDs only after final-layout validation. */
export type ClipboardItem = IndividualClipboardItem | { kind: 'group'; scene: Scene }

/** One destination proposal in world cells; carrying a station ID does not imply placement has been validated. */
export type Placement =
  | { kind: 'station'; value: Point & StationTemplate }
  | { kind: 'building'; value: Omit<Building, 'id'> }
  | { kind: 'belt'; value: Omit<Belt, 'id'> }
  | { kind: 'splitter'; value: Omit<Splitter, 'id'> }
  | { kind: 'tunnel'; value: Omit<Tunnel, 'id'> }

/** A lone symmetric floor has no orientation; every other complete template can turn. */
export function canRotateClipboard(item: ClipboardItem): boolean {
  if (item.kind === 'station') return item.type === 'drone'
  if (item.kind !== 'group') return true
  const scene = item.scene
  return (
    scene.stations.length > 1 ||
    scene.stations.some((station) => station.type === 'drone') ||
    scene.buildings.length + scene.belts.length + (scene.splitters?.length ?? 0) + (scene.tunnels?.length ?? 0) > 0
  )
}

/** Return a turned preview without modifying the clipboard. The caller retains its pivot between successive turns. */
export function rotateClipboard(item: ClipboardItem, center?: Point): { item: ClipboardItem; pivot?: Point } | null {
  if (!canRotateClipboard(item)) return null
  if (item.kind === 'building' || item.kind === 'splitter' || (item.kind === 'station' && item.type === 'drone'))
    return { item: { ...item, rotation: nextRotation(item.rotation) } }
  if (item.kind === 'station') return null
  const scene: Scene =
    item.kind === 'group'
      ? item.scene
      : {
          stations: [],
          buildings: [],
          belts: item.kind === 'belt' ? [{ ...item, id: 'preview' }] : [],
          tunnels: item.kind === 'tunnel' ? [{ ...item, id: 'preview' }] : [],
        }
  const pivot = center ?? selectionPivot(scene),
    turned = rotateGroup(scene, pivot)
  return {
    pivot,
    item:
      item.kind === 'group'
        ? { ...item, scene: turned }
        : item.kind === 'belt'
          ? { ...item, points: turned.belts[0].points, heading: turned.belts[0].heading }
          : { ...item, entry: turned.tunnels[0].entry, exit: turned.tunnels[0].exit },
  }
}

/** Capture one independent template; stale targets return null and occupied stations require the caller's group-capture fallback. */
export function captureClipboard(scene: Scene, selection: Selection): IndividualClipboardItem | null {
  if (selection.kind === 'station') {
    const station = scene.stations.find((s) => s.id === selection.id)
    if (!station || !isStationEmpty(scene, selection.id)) return null
    return station.type === 'drone'
      ? {
          kind: 'station',
          type: 'drone',
          rotation: station.rotation,
          cargo: [...station.cargo],
          ...(station.name && { name: station.name }),
          ...(station.disabledOutputs && { disabledOutputs: [...station.disabledOutputs] }),
        }
      : { kind: 'station', ...(station.type ? { type: station.type } : {}), ...(station.name && { name: station.name }) }
  }
  if (selection.kind === 'building') {
    const building = scene.buildings.find((b) => b.id === selection.id)
    return building
      ? {
          kind: 'building',
          type: building.type,
          rotation: building.rotation,
          ...(building.recipeId !== undefined && { recipeId: building.recipeId }),
          ...(building.disabledOutputs && { disabledOutputs: [...building.disabledOutputs] }),
        }
      : null
  }
  if (selection.kind === 'splitter') {
    const piece = scene.splitters?.find((s) => s.id === selection.id)
    return piece
      ? {
          kind: 'splitter',
          type: piece.type,
          rotation: piece.rotation,
          ...(piece.disabledOutputs && { disabledOutputs: [...piece.disabledOutputs] }),
        }
      : null
  }
  if (selection.kind === 'tunnel') {
    const piece = scene.tunnels?.find((t) => t.id === selection.id)
    return piece
      ? {
          kind: 'tunnel',
          type: piece.type,
          ...(piece.disabledOutputs && { disabledOutputs: [...piece.disabledOutputs] }),
          entry: { x: 0, y: 0 },
          exit: {
            x: piece.exit.x - piece.entry.x,
            y: piece.exit.y - piece.entry.y,
          },
        }
      : null
  }
  const belt = scene.belts.find((b) => b.id === selection.id),
    first = belt?.points[0]
  return belt && first
    ? {
        kind: 'belt',
        points: belt.points.map((p) => ({ x: p.x - first.x, y: p.y - first.y })),
        ...(belt.type && { type: belt.type }),
        ...(belt.heading && { heading: { ...belt.heading } }),
      }
    : null
}

/** Rebind a template to the destination floor; validity is shared by preview and confirmed transaction. */
export function placementAt(scene: Scene, item: IndividualClipboardItem, point: Point): Placement {
  if (item.kind === 'station') {
    const template: StationTemplate =
      item.type === 'drone'
        ? {
            type: 'drone',
            rotation: item.rotation,
            cargo: [...item.cargo],
            ...(item.disabledOutputs && { disabledOutputs: [...item.disabledOutputs] }),
          }
        : item.type
          ? { type: item.type }
          : {}
    return {
      kind: 'station',
      value: { ...template, ...(item.name && { name: item.name }), ...snapStation(scene.stations, { ...template, ...point }) },
    }
  }
  const stationId = stationAt(scene, point)?.id ?? ''
  if (item.kind === 'building')
    return {
      kind: 'building',
      value: {
        type: item.type,
        rotation: item.rotation,
        stationId,
        ...point,
        ...(item.recipeId !== undefined && { recipeId: item.recipeId }),
        ...(item.disabledOutputs && { disabledOutputs: [...item.disabledOutputs] }),
      },
    }
  if (item.kind === 'splitter')
    return {
      kind: 'splitter',
      value: alignSplitter(scene, {
        type: item.type,
        rotation: item.rotation,
        ...point,
        ...(item.disabledOutputs && { disabledOutputs: [...item.disabledOutputs] }),
      }),
    }
  if (item.kind === 'tunnel')
    return {
      kind: 'tunnel',
      value: {
        type: item.type,
        ...(item.disabledOutputs && { disabledOutputs: [...item.disabledOutputs] }),
        entry: { x: point.x + item.entry.x, y: point.y + item.entry.y },
        exit: {
          x: point.x + item.exit.x,
          y: point.y + item.exit.y,
        },
      },
    }
  return {
    kind: 'belt',
    value: {
      points: item.points.map((p) => ({ x: p.x + point.x, y: p.y + point.y })),
      ...(item.type && { type: item.type }),
      ...(item.heading && { heading: item.heading }),
    },
  }
}

/** Individual palette/paste proposals report their own constraint without altering confirmed geometry. */
export function placementIssue(scene: Scene, placement: Placement): string | null {
  switch (placement.kind) {
    case 'station':
      return canPlaceStation(scene.stations, placement.value) ? null : 'This station overlaps another module. Choose a free area.'
    case 'building':
      return buildingPlacementIssue(scene, placement.value)
    case 'splitter':
      return canPlaceSplitter(scene, placement.value)
        ? null
        : 'A splitter needs a free floor cell or a straight belt aligned with its input.'
    case 'tunnel':
      return tunnelPlacementIssue(scene, placement.value)
    case 'belt':
      return placement.value.points.length < 2 && !placement.value.heading
        ? 'A one-cell belt needs its direction.'
        : beltPlacementIssue(scene, placement.value)
  }
}
