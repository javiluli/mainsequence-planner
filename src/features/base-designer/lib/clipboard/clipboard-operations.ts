import { CELL_SIZE } from '../../model/catalog'
import { type BaseNote, type BasePlacement, type BaseStation } from '../layout/placement'
import { pastePlacementOwners } from '../layout/placement-validation'
import { canPasteLayout, clipboardPlacementsAt, type LayoutClipboard } from './clipboard'

interface LayoutPasteOptions {
  stations: readonly BaseStation[]
  proposal: LayoutClipboard
  allocateId: () => string
}

interface LayoutPasteResult {
  stations: BaseStation[]
  notes: BaseNote[]
  ids: string[]
}

/**
 * Validate a whole layout copy before allocating any IDs; return additions without writing state/history.
 * Locks are remapped only within the copied boundary, and all cells of each copied route share a new ID.
 * allocateId is the explicit store-owned effect; geometry and proposal validation remain independent of it.
 */
export function createLayoutPaste({ stations, proposal, allocateId }: LayoutPasteOptions): LayoutPasteResult | null {
  if (!canPasteLayout(stations, proposal)) return null
  const stationIds = new Map(proposal.stations.map((station) => [station.id, allocateId()]))
  const routeIds = new Map<string, string>()
  // Validation rejects duplicate node IDs, so this map is total for copied stations; external locks are deliberately omitted.
  const copies = structuredClone(proposal.stations).map((station) => ({
    ...station,
    id: stationIds.get(station.id)!,
    lockedTo: station.lockedTo.flatMap((id) => (stationIds.has(id) ? [stationIds.get(id)!] : [])),
    placements: station.placements.map((piece) => {
      if (piece.routeId && !routeIds.has(piece.routeId)) routeIds.set(piece.routeId, allocateId())
      return { ...piece, id: allocateId(), routeId: piece.routeId ? routeIds.get(piece.routeId) : undefined }
    }),
  }))
  const notes = structuredClone(proposal.notes).map((note) => ({ ...note, id: allocateId() }))
  return { stations: copies, notes, ids: [...copies, ...notes].map((entry) => entry.id) }
}

interface PlacementPasteOptions {
  stations: readonly BaseStation[]
  stationId: string
  source: readonly BasePlacement[]
  worldCursor: { x: number; y: number }
  allocateId: () => string
}

/**
 * Position a copied footprint in world cells, validate all owners, then materialize one local proposal.
 * Reject the complete copy before allocating IDs; never silently drop cells without an owner.
 * Allocation order preserves the first-piece return contract and one new identity per complete route.
 */
export function createPlacementPaste({
  stations,
  stationId,
  source,
  worldCursor,
  allocateId,
}: PlacementPasteOptions): { stations: BaseStation[]; firstId: string } | null {
  const worldPieces = clipboardPlacementsAt(source, worldCursor)
  const owners = pastePlacementOwners(stations, stationId, worldPieces)
  if (!owners) return null
  const routeIds = new Map<string, string>()
  const firstId = allocateId()
  const planned = worldPieces.map((piece, index) => {
    if (piece.routeId && !routeIds.has(piece.routeId)) routeIds.set(piece.routeId, allocateId())
    return {
      ...piece,
      id: index === 0 ? firstId : allocateId(),
      routeId: piece.routeId ? routeIds.get(piece.routeId) : undefined,
    }
  })
  const proposal = stations.map((owner) => {
    const copies = planned.flatMap((piece, index) =>
      owners[index].id === owner.id
        ? [{ ...piece, x: piece.x - owner.position.x / CELL_SIZE, y: piece.y - owner.position.y / CELL_SIZE }]
        : [],
    )
    return copies.length ? { ...owner, placements: [...owner.placements, ...copies] } : owner
  })
  return { stations: proposal, firstId }
}
