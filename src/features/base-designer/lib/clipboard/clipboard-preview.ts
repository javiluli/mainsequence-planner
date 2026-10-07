import { indexPlacements, type BaseStation } from '../layout/placement'
import { connectedCorridors } from '../layout/stations'
import { worldPlacements } from '../layout/world-layout'
import type { LayoutClipboard } from './clipboard'

/**
 * Project a layout ghost without editable nodes, retaining source positions in flow pixels and pieces in world cells.
 * Preview IDs must not alias originals; invalid proposals show internal corridors only, never connections to existing floor.
 */
export function createLayoutPasteGeometry({
  stations,
  proposal,
  valid,
}: {
  stations: readonly BaseStation[]
  proposal: LayoutClipboard
  valid: boolean
}) {
  // Preview identities cannot alias originals when proposing new corridors next to them.
  const draft = {
    ...proposal,
    stations: proposal.stations.map((station) => ({ ...station, id: `paste-preview-${station.id}` })),
  }
  const pieces = worldPlacements(draft.stations)
  const previewIds = new Set(draft.stations.map((station) => station.id))
  const corridors = connectedCorridors([...stations, ...draft.stations]).filter(
    (corridor) =>
      (previewIds.has(corridor.ownerId) && previewIds.has(corridor.otherId)) ||
      (valid && (previewIds.has(corridor.ownerId) || previewIds.has(corridor.otherId))),
  )
  return { draft, pieces, occupied: indexPlacements(pieces), corridors, valid }
}

export type LayoutPasteGeometry = ReturnType<typeof createLayoutPasteGeometry>
