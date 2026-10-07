import { useCallback, useMemo, useState } from 'react'
import { CELL_SIZE, isConveyorType, isRouteTool, type EditorTool, type RouteTool } from '../../model/catalog'
import type { BaseStation } from '../../lib/layout/placement'
import type { WorldPlacement } from '../../lib/layout/world-layout'
import { checkRouteInLayout } from '../../lib/routes/route-validation'
import {
  draftRouteCells,
  routeCells,
  routeMergeIds,
  sameRouteAnchor,
  type BeltJunction,
  type RouteAnchor,
  type RouteCell,
  type RouteDraft,
} from '../../lib/routes/route'
import type { RoutePreviewCell } from '../../model/station-node'

interface RouteDrawingOptions {
  stations: readonly BaseStation[]
  worldPieces: readonly WorldPlacement[]
  tool: EditorTool
  placeRoute: (
    stationId: string,
    type: RouteTool,
    cells: readonly RouteCell[],
    mergeRouteIds?: readonly string[],
    junction?: BeltJunction,
  ) => boolean
}

/**
 * Own a route's world-cell anchors and derived hover preview until a successful commit or cancellation.
 * Node callbacks supply station-local cells; projection happens here once, never through viewport pixels.
 * beforeStart lets the editor cancel competing gestures before publishing an accepted draft, without
 * coupling this controller to selection, placement or canvas listeners. Only placeRoute writes history.
 */
export function useRouteDrawing({ stations, worldPieces, tool, placeRoute }: RouteDrawingOptions) {
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null)
  const worldPreviewRoute = useMemo<RoutePreviewCell[]>(() => {
    if (!routeDraft) return []
    const cells = draftRouteCells(routeDraft)
    return cells.map((cell, index) => ({
      ...cell,
      buried: routeDraft.type.startsWith('underground') && index > 0 && index < cells.length - 1,
      routeIndex: index,
    }))
  }, [routeDraft])
  const routePreviewCheck = useMemo(
    // Hover is an unfinished proposal: short tunnel drafts remain editable; completion is checked at confirmation.
    () => (routeDraft ? checkRouteInLayout(stations, routeDraft.stationId, worldPreviewRoute, new Set(), routeDraft.type) : null),
    [routeDraft, worldPreviewRoute, stations],
  )
  const cancel = useCallback(() => setRouteDraft(null), [])

  /** Pop one accepted anchor; false tells the editor to leave drawing when the initial anchor is reached. */
  const backtrack = useCallback(() => {
    if (!routeDraft || routeDraft.anchors.length <= 1) return false
    const anchors = routeDraft.anchors.slice(0, -1)
    setRouteDraft({ ...routeDraft, anchors, hover: anchors.at(-1) ?? null })
    return true
  }, [routeDraft])

  const beginRoute = useCallback(
    (stationId: string, type: RouteTool, point: RouteAnchor, beforeStart: (type: RouteTool) => void) => {
      if (point.kind === 'port' && point.role === 'input') {
        return
      }
      const startCheck = checkRouteInLayout(stations, stationId, routeCells([point]), new Set(), type)
      if (!startCheck.ok) {
        return
      }
      // The editor cancels competing captures/previews only after the starting cell is accepted.
      beforeStart(type)
      setRouteDraft({ stationId, type, anchors: [point], hover: point })
    },
    [stations],
  )

  const handleStartBelt = useCallback(
    (stationId: string, anchor: Extract<RouteAnchor, { kind: 'port' }>, beforeStart: (type: RouteTool) => void) => {
      const station = stations.find((candidate) => candidate.id === stationId)
      if (!station) return
      // Empty-hand continuation deliberately starts MK1, regardless of the clicked output tier.
      beginRoute(
        stationId,
        'conveyor',
        {
          ...anchor,
          x: anchor.x + station.position.x / CELL_SIZE,
          y: anchor.y + station.position.y / CELL_SIZE,
        },
        beforeStart,
      )
    },
    [stations, beginRoute],
  )

  const click = useCallback(
    (stationId: string, anchor: RouteAnchor, beforeStart: (type: RouteTool) => void) => {
      const station = stations.find((candidate) => candidate.id === stationId)
      if (!station || !isRouteTool(tool)) return
      const worldX = station.position.x / CELL_SIZE + anchor.x
      const worldY = station.position.y / CELL_SIZE + anchor.y
      const point = { ...anchor, x: worldX, y: worldY }
      if (!routeDraft || routeDraft.type !== tool) {
        beginRoute(stationId, tool, point, beforeStart)
        return
      }
      const last = routeDraft.anchors[routeDraft.anchors.length - 1]
      if (point.kind === 'port') {
        if (point.role === 'output') {
          return
        }
        if (last.kind === 'port' && last.x === worldX && last.y === worldY && last.face === point.face) {
          return
        }
        const cells = routeCells([...routeDraft.anchors, point])
        const routeCheck = checkRouteInLayout(stations, routeDraft.stationId, cells, new Set(), tool, true)
        if (!routeCheck.ok) {
          return
        }
        // Only normal belts of the same tier share a route identity. Lateral joins retain their independent branch ID.
        const mergeIds = routeMergeIds(routeDraft.anchors[0], point).filter(
          (id) => isConveyorType(tool) && worldPieces.some((piece) => piece.routeId === id && piece.type === tool),
        )
        if (
          placeRoute(
            routeDraft.stationId,
            tool,
            cells,
            mergeIds,
            point.mergeTargetId ? { targetId: point.mergeTargetId, face: point.face } : undefined,
          )
        ) {
          setRouteDraft(null)
        }
        return
      }
      if (last.x === worldX && last.y === worldY) {
        // Repeating the last floor anchor confirms accepted anchors, without committing the hover tail.
        const cells = routeCells(routeDraft.anchors)
        const routeCheck = checkRouteInLayout(stations, routeDraft.stationId, cells, new Set(), tool, true)
        if (!routeCheck.ok) {
          return
        }
        const start = routeDraft.anchors[0]
        const mergeIds =
          isConveyorType(tool) &&
          start.kind === 'port' &&
          start.routeId &&
          worldPieces.some((piece) => piece.routeId === start.routeId && piece.type === tool)
            ? [start.routeId]
            : []
        if (placeRoute(routeDraft.stationId, tool, cells, mergeIds)) {
          setRouteDraft(null)
        }
        return
      }
      const anchors = [...routeDraft.anchors, point]
      const segmentCheck = checkRouteInLayout(stations, routeDraft.stationId, routeCells(anchors), new Set(), tool)
      if (!segmentCheck.ok) {
        return
      }
      setRouteDraft({ ...routeDraft, anchors, hover: point })
    },
    [stations, tool, routeDraft, worldPieces, placeRoute, beginRoute],
  )

  const handleRouteHover = useCallback(
    (stationId: string, anchor: RouteAnchor) => {
      const station = stations.find((candidate) => candidate.id === stationId)
      if (!station) return
      const hover = { ...anchor, x: anchor.x + station.position.x / CELL_SIZE, y: anchor.y + station.position.y / CELL_SIZE }
      setRouteDraft((draft) => {
        if (!draft || draft.type !== tool) return draft
        const previous = draft.hover
        if (sameRouteAnchor(previous, hover)) return draft
        return { ...draft, hover }
      })
    },
    [stations, tool],
  )

  return {
    draft: routeDraft,
    worldPreviewRoute,
    previewValid: routePreviewCheck?.ok ?? false,
    cancel,
    backtrack,
    startBelt: handleStartBelt,
    click,
    hover: handleRouteHover,
  }
}
