import { PLACEABLES, isSplitterType, isUndergroundType, type Direction } from '../../model/catalog'
import type { BasePlacement } from '../layout/placement'
import {
  beltIncoming,
  beltOutputs,
  beltInputFaces,
  beltConnection,
  surfaceBeltPortRole,
  type CanTraverseEdge,
  type OccupiedCells,
} from './connections'
import { oppositeDirection, directionSteps as steps } from './ports'

export interface ExternalOutputPort {
  x: number
  y: number
  face: Direction
}

/** One confirmed, directed passage through a belt tile. Other visible branches stay still. */
export interface BeltFlow {
  entering: Direction
  leaving: Direction
  /** Cumulative SVG path distance, in a 20-unit tile; this is not flow pixels, throughput or time. */
  phase: number
}

/** The phase keeps moving slats continuous across straight cells and rounded corners. */
function beltLength(belt: BasePlacement, entering: Direction, leaving: Direction): number {
  if (isSplitterType(belt.type) || entering !== beltIncoming(belt)) return 20
  // Match BeltArtwork's quadratic Q10 10 bend rather than its straight-line chord; canvas CELL_SIZE/zoom do not set SVG distance.
  return entering === oppositeDirection(leaving) ? 20 : 10 + (10 * Math.asinh(1)) / Math.SQRT2
}

/**
 * Derive animation passages only for directed paths from a machine/external output to a receiving machine.
 * placements, surface occupied and traversal share one cell frame; return phases without mutating the layout.
 * This forward path walk is separate from upstream product tracing and does not calculate delivered rates.
 */
export function connectedProductionBelts(
  placements: readonly BasePlacement[],
  occupied: OccupiedCells,
  canTraverse?: CanTraverseEdge,
  externalOutputs: readonly ExternalOutputPort[] = [],
): Map<string, BeltFlow[]> {
  const active = new Map<string, BeltFlow[]>()
  const tunnelRoutes = new Map<string, BasePlacement[]>()
  for (const piece of placements) {
    if (!piece.routeId || !isUndergroundType(piece.type)) continue
    const route = tunnelRoutes.get(piece.routeId) ?? []
    route.push(piece)
    tunnelRoutes.set(piece.routeId, route)
  }
  const tunnelExits = new Map<string, { exit: BasePlacement; buriedCells: number }>()
  for (const route of tunnelRoutes.values()) {
    route.sort((first, second) => (first.routeIndex ?? 0) - (second.routeIndex ?? 0))
    if (route.length >= 3) tunnelExits.set(route[0].id, { exit: route[route.length - 1], buriedCells: route.length - 2 })
  }
  interface FlowStep {
    belt: BasePlacement
    entering: Direction
    leaving: Direction
    length: number
  }
  // Publish only after a sink is reached: dead ends and cycles do not activate an unfinished branch.
  const markPath = (path: readonly FlowStep[]) => {
    let distance = 0
    for (const step of path) {
      const flows = active.get(step.belt.id) ?? []
      if (!flows.some((flow) => flow.entering === step.entering && flow.leaving === step.leaving)) {
        flows.push({ entering: step.entering, leaving: step.leaving, phase: distance })
        active.set(step.belt.id, flows)
      }
      distance += step.length
    }
  }
  const walkFrom = (start: BasePlacement, entering: Direction, sourceId?: string) => {
    const walk = (current: BasePlacement, entering: Direction, path: FlowStep[], visited: Set<string>) => {
      if (visited.has(current.id)) return
      const nextVisited = new Set(visited).add(current.id)
      const tunnel = tunnelExits.get(current.id)
      if (tunnel) {
        // This virtual passage reaches the outlet's buried side without creating a surface input there.
        walk(
          tunnel.exit,
          beltIncoming(tunnel.exit),
          [
            ...path,
            {
              belt: current,
              entering,
              leaving: current.direction,
              length: beltLength(current, entering, current.direction) + tunnel.buriedCells * 20,
            },
          ],
          nextVisited,
        )
        return
      }
      for (const face of beltOutputs(current)) {
        const next = beltConnection(occupied, current, face, canTraverse)
        if (!next) continue
        const nextPath = [...path, { belt: current, entering, leaving: face, length: beltLength(current, entering, face) }]
        if (PLACEABLES[next.type].category === 'machine') {
          if (next.id !== sourceId) markPath(nextPath)
        } else {
          walk(next, oppositeDirection(face), nextPath, nextVisited)
        }
      }
    }
    walk(start, entering, [], new Set())
  }
  for (const start of placements) {
    if (PLACEABLES[start.type].category !== 'logistics') continue
    for (const face of beltInputFaces(occupied, start, canTraverse)) {
      const source = beltConnection(occupied, start, face, canTraverse)
      if (source && PLACEABLES[source.type].category === 'machine') {
        walkFrom(start, face, source.id)
      }
    }
  }
  for (const port of externalOutputs) {
    const start = occupied.get(`${port.x},${port.y}`)
    const [dx, dy] = steps[port.face]
    if (
      start &&
      PLACEABLES[start.type].category === 'logistics' &&
      surfaceBeltPortRole(start, oppositeDirection(port.face)) === 'input' &&
      (!canTraverse || canTraverse(port.x - dx, port.y - dy, port.face))
    ) {
      walkFrom(start, oppositeDirection(port.face))
    }
  }
  return active
}

/**
 * Extend confirmed inlet phases to buried artwork in a new map, preserving the surface occupancy contract.
 * Derive once for the parent render snapshot; buried cells must never become neighbors just to animate them.
 */
export function withBuriedBeltFlows(
  placements: readonly BasePlacement[],
  confirmed: ReadonlyMap<string, readonly BeltFlow[]>,
): ReadonlyMap<string, readonly BeltFlow[]> {
  const flows = new Map(confirmed)
  const entrances = new Map<string, readonly BeltFlow[]>()
  for (const piece of placements) {
    if (isUndergroundType(piece.type) && piece.routeId && piece.routeIndex === 0 && !piece.buried) {
      const entranceFlows = confirmed.get(piece.id)
      if (entranceFlows?.length) entrances.set(piece.routeId, entranceFlows)
    }
  }
  for (const piece of placements) {
    const index = piece.routeIndex
    if (!piece.buried || !piece.routeId || index === undefined) continue
    const entranceFlows = entrances.get(piece.routeId)
    if (entranceFlows) {
      flows.set(
        piece.id,
        entranceFlows.map((flow) => ({
          entering: beltIncoming(piece),
          leaving: piece.direction,
          // BeltFlow distances use the 20-unit SVG path, independent of canvas zoom or pixel pitch.
          phase: flow.phase + index * 20,
        })),
      )
    }
  }
  return flows
}
