import { PLACEABLES, isSplitterType, type Direction } from '../model/catalog'
import { machinePorts, oppositeDirection, portOutsideCell, type MachinePort } from './ports'
import type { BasePlacement } from './placement'

export type OccupiedCells = ReadonlyMap<string, BasePlacement>
export type CanTraverseEdge = (x: number, y: number, face: Direction) => boolean

const steps: Record<Direction, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
}
const faces: Direction[] = ['north', 'east', 'south', 'west']

export function beltIncoming(placement: BasePlacement): Direction {
  return placement.incoming ?? oppositeDirection(placement.direction)
}

/** A splitter receives on one face and can send to each of the other three. */
export function beltOutputs(placement: BasePlacement): Direction[] {
  const incoming = beltIncoming(placement)
  return isSplitterType(placement.type) ? faces.filter((face) => face !== incoming) : [placement.direction]
}

export function neighborAt(
  occupied: OccupiedCells,
  placement: BasePlacement,
  face: Direction,
  canTraverse?: CanTraverseEdge,
): BasePlacement | undefined {
  if (canTraverse && !canTraverse(placement.x, placement.y, face)) return undefined
  const [dx, dy] = steps[face]
  return occupied.get(`${placement.x + dx},${placement.y + dy}`)
}

function machineHasPort(machine: BasePlacement, belt: BasePlacement): boolean {
  return machinePorts(machine).some((port) => {
    const outside = portOutsideCell(machine, port)
    return outside.x === belt.x && outside.y === belt.y
  })
}

/** Adjacent belts only meet head-to-tail, never merely because their occupied cells touch. */
export function beltConnection(
  occupied: OccupiedCells,
  belt: BasePlacement,
  face: Direction,
  canTraverse?: CanTraverseEdge,
): BasePlacement | undefined {
  const neighbor = neighborAt(occupied, belt, face, canTraverse)
  if (!neighbor) return undefined
  if (PLACEABLES[neighbor.type].category === 'machine') {
    return machineHasPort(neighbor, belt) && (face === beltIncoming(belt) || beltOutputs(belt).includes(face)) ? neighbor : undefined
  }
  const reciprocal = oppositeDirection(face)
  const forward = beltOutputs(belt).includes(face) && beltIncoming(neighbor) === reciprocal
  const backward = beltIncoming(belt) === face && beltOutputs(neighbor).includes(reciprocal)
  return forward || backward ? neighbor : undefined
}

/** The belt's entering face receives from a machine; its outgoing face delivers to one. */
export function machinePortFlow(
  occupied: OccupiedCells,
  machine: BasePlacement,
  port: MachinePort,
  canTraverse?: CanTraverseEdge,
): 'input' | 'output' | null {
  const cell = portOutsideCell(machine, port)
  const [dx, dy] = steps[port.face]
  if (canTraverse && !canTraverse(cell.x - dx, cell.y - dy, port.face)) return null
  const belt = occupied.get(`${cell.x},${cell.y}`)
  if (!belt || PLACEABLES[belt.type].category !== 'logistics') return null
  const beltFace = oppositeDirection(port.face)
  if (beltIncoming(belt) === beltFace) return 'output'
  if (beltOutputs(belt).includes(beltFace)) return 'input'
  return null
}

/** The phase keeps moving slats continuous across straight cells and rounded corners. */
function beltLength(belt: BasePlacement): number {
  // Length of the quadratic Q10 10 bend used by BeltTile, not its straight-line chord.
  return beltIncoming(belt) === oppositeDirection(belt.direction) ? 20 : 10 + (10 * Math.asinh(1)) / Math.SQRT2
}

/** Animate only directed paths that start at an output opening and reach an input opening. */
export function connectedProductionBelts(
  placements: readonly BasePlacement[],
  occupied: OccupiedCells,
  canTraverse?: CanTraverseEdge,
): Map<string, number> {
  const active = new Map<string, number>()
  for (const start of placements) {
    if (PLACEABLES[start.type].category !== 'logistics') continue
    const source = neighborAt(occupied, start, beltIncoming(start), canTraverse)
    if (!source || PLACEABLES[source.type].category !== 'machine' || !machineHasPort(source, start)) continue

    const walk = (current: BasePlacement, path: BasePlacement[], visited: Set<string>) => {
      if (visited.has(current.id)) return
      const nextPath = [...path, current]
      const nextVisited = new Set(visited).add(current.id)
      for (const face of beltOutputs(current)) {
        const next = beltConnection(occupied, current, face, canTraverse)
        if (!next) continue
        if (PLACEABLES[next.type].category === 'machine') {
          if (next.id !== source.id) {
            let distance = 0
            nextPath.forEach((belt) => {
              if (!active.has(belt.id)) active.set(belt.id, distance)
              distance += beltLength(belt)
            })
          }
        } else {
          walk(next, nextPath, nextVisited)
        }
      }
    }
    walk(start, [], new Set())
  }
  return active
}
