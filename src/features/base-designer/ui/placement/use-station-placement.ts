import { useCallback, useState, type PointerEvent } from 'react'
import { rotateLayout, type QuarterTurn } from '../../lib/layout/layout-transform'
import { type BaseStation } from '../../lib/layout/placement'
import { stationPlacementOrigin } from '../../lib/geometry/station-spatial'
import { canPlaceStation } from '../../lib/layout/stations'
import { STATION_TYPES, type StationType } from '../../model/catalog'

/**
 * Owns a repeatable station build preview, snapping projected flow pixels to the station grid.
 * Confirmation delegates validation to the store and retains the tool until the editor cancels it.
 */
export function useStationPlacement({
  stations,
  project,
  getBounds,
  onConfirm,
}: {
  stations: readonly BaseStation[]
  project: (point: { x: number; y: number }) => { x: number; y: number }
  getBounds: () => DOMRect | undefined
  onConfirm: (station: BaseStation) => boolean
}) {
  const [draft, setDraft] = useState<BaseStation | null>(null)
  const cancel = useCallback(() => setDraft(null), [])
  const rotate = (turn: QuarterTurn) => {
    if (!draft) return false
    const source = rotateLayout({ stations: [draft], notes: [], skippedParts: 0, skippedRoutes: 0 }, turn)
    setDraft(source.stations[0])
    return true
  }
  const start = (type: StationType) => {
    const bounds = getBounds()
    const center = project({ x: bounds ? bounds.left + bounds.width / 2 : 0, y: bounds ? bounds.top + bounds.height / 2 : 0 })
    setDraft({
      id: 'station-preview',
      type,
      name: STATION_TYPES[type].label,
      position: stationPlacementOrigin(center, type),
      direction: 'south',
      lockedTo: [],
      placements: [],
    })
  }
  const atPointer = (event: PointerEvent<HTMLDivElement>) =>
    draft
      ? {
          ...draft,
          position: stationPlacementOrigin(project({ x: event.clientX, y: event.clientY }), draft.type),
        }
      : null
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || !draft) return
    const next = atPointer(event)
    if (next && (next.position.x !== draft.position.x || next.position.y !== draft.position.y)) setDraft(next)
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || !draft) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    const next = atPointer(event)
    if (next) {
      setDraft(next)
      onConfirm(next)
    }
  }

  return {
    draft,
    active: draft !== null,
    valid: draft ? canPlaceStation(stations, draft) : false,
    start,
    cancel,
    rotate,
    handlePointerMove,
    handlePointerDown,
  }
}
