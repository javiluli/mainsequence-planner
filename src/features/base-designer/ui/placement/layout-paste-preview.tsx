import type { LayoutClipboard } from '../../lib/clipboard/clipboard'
import type { OccupiedCells } from '../../lib/connections/connections'
import type { StationCorridor } from '../../lib/layout/stations'
import type { BasePlacement } from '../../lib/layout/placement'
import { PLACEABLES } from '../../model/catalog'
import { StationPreview } from '../artwork/station-artwork'
import { BeltTile } from '../artwork/belt-tile'
import { MachineTile } from '../artwork/machine-tile'

/** Reuse the existing artwork without mounting editable nodes or duplicating corridor geometry. */
export function LayoutPastePreview({
  draft,
  valid,
  corridors,
  pieces,
  occupied,
}: {
  draft: LayoutClipboard
  valid: boolean
  corridors: readonly StationCorridor[]
  pieces: readonly BasePlacement[]
  occupied: OccupiedCells
}) {
  return (
    <div data-layout-paste-preview data-valid={valid} aria-hidden className="pointer-events-none">
      {draft.stations.map((station, index) => (
        <StationPreview
          key={station.id}
          station={station}
          valid={valid}
          corridors={corridors}
          corridorArtwork={index === 0 ? corridors : []}
        />
      ))}
      <PlacementPastePreview pieces={pieces} occupied={occupied} valid={valid} />
      {draft.notes.map((note) => (
        <div
          key={note.id}
          className="base-note pointer-events-none absolute z-40 w-48 whitespace-pre-wrap border border-primary bg-content1/95 p-2 text-xs"
          style={{ left: note.position.x, top: note.position.y }}
        >
          {note.text || 'Note'}
        </div>
      ))}
    </div>
  )
}

export function PlacementPastePreview({
  pieces,
  occupied,
  valid,
}: {
  pieces: readonly BasePlacement[]
  occupied: OccupiedCells
  valid: boolean
}) {
  return (
    <div data-placement-paste-preview data-valid={valid} aria-hidden className="pointer-events-none absolute z-40">
      {pieces.map((piece) =>
        PLACEABLES[piece.type].category === 'logistics' ? (
          <BeltTile key={piece.id} placement={piece} occupied={occupied} preview valid={valid} />
        ) : (
          <MachineTile key={piece.id} placement={piece} occupied={occupied} preview valid={valid} />
        ),
      )}
    </div>
  )
}
