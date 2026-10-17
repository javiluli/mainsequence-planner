import type { Point, Scene, Selection } from '../model/scene'
import { rotateGroup, translateGroup } from './scene-geometry'
import { samePoint } from './belts'
import { alignSplitter, scenePlacementIssue, stationAt } from './placement'
import { selectionScene } from './selection'

/** Captured geometry is rechecked on release; unrelated edits still undergo final-layout validation. */
export type SelectionTransform = { kind: 'move'; offset: Point } | { kind: 'rotate'; pivot: Point }

/** Replace explicit IDs in place, preserving unselected references, ownership and all-or-nothing validation. */
export function proposeSelectionTransform(
  scene: Scene,
  selection: readonly Selection[],
  transform: SelectionTransform,
  from: Scene = scene,
): { scene: Scene | null; issue: string | null } {
  const selected = selectionScene(scene, selection),
    captured = selectionScene(from, selection)
  if (!selected || !captured) return { scene: null, issue: 'The selection changed. Select the elements again.' }
  for (const key of ['stations', 'buildings', 'belts', 'splitters', 'tunnels'] as const)
    if (selected[key]?.some((item, index) => item !== captured[key]?.[index]))
      return { scene: null, issue: 'An element changed during the gesture. Start again.' }
  if (transform.kind === 'move') {
    if (!Number.isSafeInteger(transform.offset.x) || !Number.isSafeInteger(transform.offset.y))
      return { scene: null, issue: 'Keep the selection on the grid.' }
    if (samePoint(transform.offset, { x: 0, y: 0 })) return { scene, issue: null }
  } else if (!Number.isSafeInteger(transform.pivot.x + transform.pivot.y) || !Number.isSafeInteger(transform.pivot.y - transform.pivot.x))
    return { scene: null, issue: 'The rotation center must preserve whole grid cells.' }
  const changed = transform.kind === 'move' ? translateGroup(selected, transform.offset) : rotateGroup(selected, transform.pivot)
  // Preserve individual inline placement; a group never silently changes its internal orientation.
  if (transform.kind === 'move' && selection.length === 1 && changed.splitters[0]) {
    const piece = changed.splitters[0]
    changed.splitters = [{ ...alignSplitter(scene, piece), id: piece.id }]
  }
  const replace = <T extends { id: string }>(items: readonly T[], updates: readonly T[]) => {
    if (!updates.length) return items
    const byId = new Map(updates.map((item) => [item.id, item]))
    return items.map((item) => byId.get(item.id) ?? item)
  }
  // A symmetric ordinary floor rotated in place is a no-op, including its history and storage.
  changed.stations = changed.stations.map((station) => {
    const previous = selected.stations.find((item) => item.id === station.id)
    return previous && previous.type !== 'drone' && samePoint(previous, station) ? previous : station
  })
  const stations = replace(scene.stations, changed.stations)
  const final: Scene = {
    stations: stations.every((station, index) => station === scene.stations[index]) ? scene.stations : stations,
    buildings: replace(
      scene.buildings,
      changed.buildings.map((building) => ({ ...building, stationId: stationAt({ ...scene, stations }, building)?.id ?? '' })),
    ),
    belts: replace(scene.belts, changed.belts),
    splitters: replace(scene.splitters ?? [], changed.splitters),
    tunnels: replace(scene.tunnels ?? [], changed.tunnels),
  }
  const issue = scenePlacementIssue(final)
  return { scene: issue ? null : final, issue }
}
