import { CELL_SIZE, snapToGrid, type Belt, type Point, type Scene } from '../model/scene'
import type { Tunnel } from '../model/logistics'
import type { ClipboardItem } from './clipboard'
import { beltConnections, samePoint } from './belts'
import { canDrawBelt } from './placement'

/** Session-only drafts shared by proposals and artwork; the UI hook owns transitions, never the confirmed scene. */
export type EditorTool =
  | { kind: 'select' }
  | { kind: 'place'; item: ClipboardItem; pivot?: Point }
  | { kind: 'tunnel'; type: Tunnel['type']; entry?: Point }
  | {
      kind: 'belt'
      type?: Belt['type']
      points: readonly Point[]
      extension?: Belt
      startNormal?: Point
      /** Each click can add a corner and a destination; right-click removes that complete click. */
      clickEnds?: readonly number[]
    }

/** Extension drafts contain only new anchors; validation and commit receive the complete original route. */
export function beltDraftPoints(tool: Extract<EditorTool, { kind: 'belt' }>, points = tool.points): readonly Point[] {
  return tool.extension ? [...tool.extension.points.slice(0, -1), ...points] : points
}

/** Prefer the current axis, then try the other elbow; if both fail, return the preferred invalid shape for feedback without editing anchors. */
export function proposeBeltDraft(tool: Extract<EditorTool, { kind: 'belt' }>, scene: Scene, point: Point, normal?: Point) {
  const last = tool.points.at(-1)
  let tails: Point[][] = last && samePoint(last, point) ? [[]] : [[point]]
  if (last && last.x !== point.x && last.y !== point.y) {
    const previous = tool.points.at(-2) ?? tool.extension?.points.at(-2)
    const direction = previous ? { x: last.x - previous.x, y: last.y - previous.y } : (tool.extension?.heading ?? tool.startNormal)
    const horizontalFirst = direction ? direction.x !== 0 : Math.abs(point.x - last.x) >= Math.abs(point.y - last.y)
    const horizontal = { x: point.x, y: last.y },
      vertical = { x: last.x, y: point.y }
    tails = (horizontalFirst ? [horizontal, vertical] : [vertical, horizontal]).map((corner) => [corner, point])
  }
  let first: readonly Point[] = tool.points
  let firstHeading: Point | undefined
  for (const [index, tail] of tails.entries()) {
    const points = [...tool.points, ...tail]
    const complete = beltDraftPoints(tool, points)
    // A one-cell route has no segment: use its sender normal or reverse the destination's outward normal.
    const heading =
      complete.length === 1
        ? (tool.startNormal ?? (normal && { x: last ? -normal.x : normal.x, y: last ? -normal.y : normal.y }))
        : undefined
    if (index === 0) {
      first = points
      firstHeading = heading
    }
    if (
      canDrawBelt(
        scene,
        { points: complete, type: tool.extension ? tool.extension.type : tool.type, ...(heading && { heading }) },
        tool.extension?.id,
      )
    )
      return { points, heading, valid: true }
  }
  return { points: first, heading: firstHeading, valid: false }
}

/** A fresh one-cell gesture needs a directed connection between distinct owners.
 * This finish condition is not a validity invariant for copied, moved or persisted routes.
 */
export function canFinishOneCellBelt(scene: Scene, belt: Pick<Belt, 'points' | 'heading'>, destinationNormal?: Point): boolean {
  if (belt.points.length !== 1 || !belt.heading || !destinationNormal || samePoint(destinationNormal, belt.heading)) return false
  const connections = beltConnections(scene, belt)
  const source = connections.output?.buildingId ?? connections.logisticsOutput?.owner.id ?? connections.droneOutput?.stationId
  const receiver = connections.input?.buildingId ?? connections.logisticsInput?.owner.id
  return !!source && !!receiver && source !== receiver
}

/** Belts use cell centers; building/station origins retain the existing nearest-grid placement. */
export function toolPoint(tool: EditorTool, world: Point, port?: Point): Point {
  if (tool.kind === 'belt') return port ?? { x: Math.floor(world.x / CELL_SIZE), y: Math.floor(world.y / CELL_SIZE) }
  if (tool.kind === 'tunnel' || (tool.kind === 'place' && ['belt', 'splitter', 'tunnel'].includes(tool.item.kind)))
    return { x: Math.floor(world.x / CELL_SIZE), y: Math.floor(world.y / CELL_SIZE) }
  return snapToGrid(world)
}

/** Two-click tunnels snap to the dominant axis; preview and commit share this exact proposed route. */
export function tunnelDraft(tool: Extract<EditorTool, { kind: 'tunnel' }>, point: Point): Omit<Tunnel, 'id'> {
  const entry = tool.entry ?? point
  const exit = Math.abs(point.x - entry.x) >= Math.abs(point.y - entry.y) ? { x: point.x, y: entry.y } : { x: entry.x, y: point.y }
  return { type: tool.type, entry, exit }
}
