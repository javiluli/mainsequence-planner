import type { EditorSelection } from '../../model/editor-selection'
import type { BaseNote, BaseStation } from './placement'
import { hasLinkedNeighbor, hasSpanningPlacement } from './world-layout'

type StationRemovalBlocker = 'missing-station' | 'locked-station' | 'occupied-corridor' | 'spanning-placement'
export type RemovalBlocker = StationRemovalBlocker | 'empty-selection' | 'multiple-nodes' | 'missing-selection'
export type StationRemovalCheck = { allowed: true; needsConfirmation: boolean } | { allowed: false; reason: StationRemovalBlocker }

export type RemovalTarget =
  { kind: 'placements'; ids: string[] } | { kind: 'note'; id: string } | { kind: 'station'; id: string; needsConfirmation: boolean }
export type SelectionRemovalCheck = { allowed: true; target: RemovalTarget } | { allowed: false; reason: RemovalBlocker }

/** Shared preflight and commit rule. Contents need confirmation; links and spanning geometry prohibit removing the floor. */
export function stationRemovalCheck(stations: readonly BaseStation[], id: string): StationRemovalCheck {
  const station = stations.find((candidate) => candidate.id === id)
  if (!station) return { allowed: false, reason: 'missing-station' }
  // Movement treats locks in either direction as a link; removal must not leave another module pointing at missing floor.
  if (station.lockedTo.length || stations.some((candidate) => candidate.lockedTo.includes(id)))
    return { allowed: false, reason: 'locked-station' }
  if (hasLinkedNeighbor(stations, id)) return { allowed: false, reason: 'occupied-corridor' }
  if (hasSpanningPlacement(stations, id)) return { allowed: false, reason: 'spanning-placement' }
  return { allowed: true, needsConfirmation: Boolean(station.placements.length || station.droneOutputs?.some(Boolean)) }
}

/** Resolve selected identities only; editing context and coordinates never choose what Delete removes. */
export function selectionRemovalCheck(
  selection: EditorSelection,
  stations: readonly BaseStation[],
  notes: readonly BaseNote[],
): SelectionRemovalCheck {
  if (!selection) return { allowed: false, reason: 'empty-selection' }
  if (selection.kind === 'area') {
    const selected = new Set(selection.ids)
    const ids = stations.flatMap((station) => station.placements.filter((piece) => selected.has(piece.id)).map((piece) => piece.id))
    return ids.length ? { allowed: true, target: { kind: 'placements', ids } } : { allowed: false, reason: 'missing-selection' }
  }
  if (selection.kind === 'part') {
    const exists = stations.some(
      (station) => station.id === selection.stationId && station.placements.some((piece) => piece.id === selection.placementId),
    )
    return exists
      ? { allowed: true, target: { kind: 'placements', ids: [selection.placementId] } }
      : { allowed: false, reason: 'missing-selection' }
  }
  if (selection.ids.length > 1) return { allowed: false, reason: 'multiple-nodes' }
  const id = selection.ids[0]
  if (!id) return { allowed: false, reason: 'empty-selection' }
  if (notes.some((note) => note.id === id)) return { allowed: true, target: { kind: 'note', id } }
  const check = stationRemovalCheck(stations, id)
  return check.allowed ? { allowed: true, target: { kind: 'station', id, needsConfirmation: check.needsConfirmation } } : check
}
