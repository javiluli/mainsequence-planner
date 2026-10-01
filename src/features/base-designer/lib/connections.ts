import { PLACEABLES, isSplitterType, isUndergroundType, type Direction } from '../model/catalog'
import { machinePortKey, machinePorts, oppositeDirection, portOutsideCell, type MachinePort } from './ports'
import type { BasePlacement } from './placement'

export type OccupiedCells = ReadonlyMap<string, BasePlacement>
export type CanTraverseEdge = (x: number, y: number, face: Direction) => boolean
export interface ExternalOutputPort {
  x: number
  y: number
  face: Direction
}

/** One confirmed, directed passage through a belt tile. Other visible branches stay still. */
export interface BeltFlow {
  entering: Direction
  leaving: Direction
  phase: number
}

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

function machineHasPort(machine: BasePlacement, belt: BasePlacement, output: boolean): boolean {
  return machinePorts(machine).some((port) => {
    const outside = portOutsideCell(machine, port)
    return outside.x === belt.x && outside.y === belt.y && (!output || !machine.disabledOutputPorts?.includes(machinePortKey(port)))
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
    return machineHasPort(neighbor, belt, face === beltIncoming(belt)) && (face === beltIncoming(belt) || beltOutputs(belt).includes(face))
      ? neighbor
      : undefined
  }
  const reciprocal = oppositeDirection(face)
  const forward =
    beltOutputs(belt).includes(face) && (beltIncoming(neighbor) === reciprocal || Boolean(neighbor.extraIncoming?.includes(reciprocal)))
  const backward =
    (beltIncoming(belt) === face || Boolean(belt.extraIncoming?.includes(face))) && beltOutputs(neighbor).includes(reciprocal)
  return forward || backward ? neighbor : undefined
}

/** A port needs reachable floor beyond the machine, including through an aligned doorway. */
export function canAccessMachinePort(machine: BasePlacement, port: MachinePort, canTraverse: CanTraverseEdge): boolean {
  const outside = portOutsideCell(machine, port)
  const [dx, dy] = steps[port.face]
  return canTraverse(outside.x - dx, outside.y - dy, port.face)
}

/** The belt's entering face receives from a machine; its outgoing face delivers to one. */
export function machinePortFlow(
  occupied: OccupiedCells,
  machine: BasePlacement,
  port: MachinePort,
  canTraverse?: CanTraverseEdge,
): 'input' | 'output' | 'disabled-output' | null {
  const cell = portOutsideCell(machine, port)
  if (canTraverse && !canAccessMachinePort(machine, port, canTraverse)) return null
  const belt = occupied.get(`${cell.x},${cell.y}`)
  if (!belt || PLACEABLES[belt.type].category !== 'logistics') return null
  const beltFace = oppositeDirection(port.face)
  if (beltIncoming(belt) === beltFace) return machine.disabledOutputPorts?.includes(machinePortKey(port)) ? 'disabled-output' : 'output'
  if (beltOutputs(belt).includes(beltFace)) return 'input'
  return null
}

/** The phase keeps moving slats continuous across straight cells and rounded corners. */
function beltLength(belt: BasePlacement, entering: Direction, leaving: Direction): number {
  if (isSplitterType(belt.type) || belt.extraIncoming?.includes(entering)) return 20
  // Length of the quadratic Q10 10 bend used by BeltTile, not its straight-line chord.
  return entering === oppositeDirection(leaving) ? 20 : 10 + (10 * Math.asinh(1)) / Math.SQRT2
}

/** Animate only directed paths that start at an output opening and reach an input opening. */
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
    for (const face of [beltIncoming(start), ...(start.extraIncoming ?? [])]) {
      const source = neighborAt(occupied, start, face, canTraverse)
      if (source && PLACEABLES[source.type].category === 'machine' && machineHasPort(source, start, true)) {
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
      [beltIncoming(start), ...(start.extraIncoming ?? [])].includes(oppositeDirection(port.face)) &&
      (!canTraverse || canTraverse(port.x - dx, port.y - dy, port.face))
    ) {
      walkFrom(start, oppositeDirection(port.face))
    }
  }
  return active
}
