import { useCallback, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  canPasteLayout,
  clipboardLayoutAt,
  clipboardPlacementPreview,
  createRoutePlacementPreview,
  type ClipboardPasteProposal,
  type EditorClipboard,
  type LayoutClipboard,
} from '../../lib/clipboard/clipboard'
import { layoutRotationPivot, rotateLayout, rotatePlacements, translateLayout, type QuarterTurn } from '../../lib/layout/layout-transform'
import { type BasePlacement, type BaseStation } from '../../lib/layout/placement'
import { type RouteCell } from '../../lib/routes/route'
import { flowToWorldCell, snappedFlowDelta } from '../../lib/geometry/station-spatial'
import { type RouteTool } from '../../model/catalog'

type Point = { x: number; y: number }
type PreviewSession =
  | { kind: 'layout'; draft: LayoutClipboard; pivot: Point; pointer: Point }
  | { kind: 'placements'; source: readonly BasePlacement[]; turns: number; cursor: Point }

export type PlacementPreview =
  | { kind: 'layout'; draft: LayoutClipboard; valid: boolean }
  | ({ kind: 'placements'; source: BasePlacement[]; cursor: Point } & ReturnType<typeof clipboardPlacementPreview>)

function previewFor(session: PreviewSession, stations: readonly BaseStation[]): PlacementPreview {
  if (session.kind === 'layout') return { kind: 'layout', draft: session.draft, valid: canPasteLayout(stations, session.draft) }
  const source = rotatePlacements(session.source, session.turns)
  return { kind: 'placements', source, cursor: session.cursor, ...clipboardPlacementPreview(stations, source, session.cursor) }
}

/** One repeatable canvas proposal. Layout coordinates are flow pixels; placement cursors are world cells. */
export function usePlacementPreview({
  stations,
  project,
  onConfirm,
}: {
  stations: readonly BaseStation[]
  project: (client: Point) => Point
  onConfirm: (proposal: ClipboardPasteProposal) => boolean
}) {
  const [session, setSession] = useState<PreviewSession | null>(null)
  const current = useRef<PreviewSession | null>(null)
  const publish = useCallback((next: PreviewSession | null) => {
    if (current.current === next) return
    // Native wheel/keyboard events can arrive before React paints. The ref and render snapshot are published together, without effects.
    current.current = next
    setSession(next)
  }, [])
  const cancel = useCallback(() => publish(null), [publish])
  const start = useCallback(
    (payload: EditorClipboard, client: Point) => {
      const projected = project(client)
      if (payload.kind === 'layout') {
        if (!payload.source.stations.length && !payload.source.notes.length) return false
        const draft = clipboardLayoutAt(payload.source, projected)
        publish({ kind: 'layout', draft, pivot: layoutRotationPivot(draft), pointer: projected })
      } else {
        if (!payload.source.length) return false
        publish({
          kind: 'placements',
          source: payload.source,
          turns: 0,
          cursor: flowToWorldCell(projected),
        })
      }
      return true
    },
    [project, publish],
  )
  const startRoute = useCallback(
    (type: RouteTool, cells: readonly (RouteCell & { buried: boolean; routeIndex: number })[], turn: QuarterTurn) => {
      const draft = createRoutePlacementPreview(type, cells)
      if (!draft) return false
      // Route draft cells are already in the world grid; do not project them through client/flow a second time.
      publish({ kind: 'placements', ...draft, turns: (turn + 4) % 4 })
      return true
    },
    [publish],
  )
  const rotate = useCallback(
    (turn: QuarterTurn) => {
      const active = current.current
      if (!active) return false
      publish(
        active.kind === 'layout'
          ? { ...active, draft: rotateLayout(active.draft, turn, active.pivot) }
          : { ...active, turns: (active.turns + turn + 4) % 4 },
      )
      return true
    },
    [publish],
  )
  const translate = (active: Extract<PreviewSession, { kind: 'layout' }>, step: Point): PreviewSession => {
    if (!step.x && !step.y) return active
    // Only translation moves the gesture pivot and pointer anchor. Rotation must never recalculate either from new bounds.
    return {
      ...active,
      draft: translateLayout(active.draft, step),
      pivot: { x: active.pivot.x + step.x, y: active.pivot.y + step.y },
      pointer: { x: active.pointer.x + step.x, y: active.pointer.y + step.y },
    }
  }
  const atPointer = (active: PreviewSession, client: Point): PreviewSession => {
    const projected = project(client)
    if (active.kind === 'placements') {
      const cursor = flowToWorldCell(projected)
      return cursor.x === active.cursor.x && cursor.y === active.cursor.y ? active : { ...active, cursor }
    }
    return translate(active, snappedFlowDelta(active.pointer, projected))
  }
  const confirm = (active: PreviewSession) => {
    // Artwork validity is feedback, not permission. The store revalidates the whole proposal against its current layout.
    if (active.kind === 'layout') return onConfirm({ kind: 'layout', draft: active.draft })
    const source = rotatePlacements(active.source, active.turns)
    const { stationId } = clipboardPlacementPreview(stations, source, active.cursor)
    return stationId ? onConfirm({ kind: 'placements', source, cursor: active.cursor, stationId }) : false
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = current.current
    if (!active || !event.isPrimary) return
    publish(atPointer(active, { x: event.clientX, y: event.clientY }))
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const active = current.current
    if (!active || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    const next = atPointer(active, { x: event.clientX, y: event.clientY })
    publish(next)
    confirm(next)
  }

  const preview = useMemo(() => session && previewFor(session, stations), [session, stations])
  return { preview, active: session !== null, start, startRoute, cancel, rotate, handlePointerMove, handlePointerDown }
}
