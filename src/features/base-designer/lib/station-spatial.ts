import { beltConnection, beltIncoming, canAccessMachinePort, type CanTraverseEdge, type OccupiedCells } from './connections'
import { type BasePlacement, type BaseStation } from './placement'
import { machinePorts, oppositeDirection, portOutsideCell, type MachinePort } from './ports'
import { type RouteAnchor, type RouteDraft } from './route'
import { droneOutputPorts } from './stations'
import { CELL_SIZE, PLACEABLES, STATION_TYPES, isSplitterType, type Direction, type EditorTool } from '../model/catalog'

interface ClientPoint {
  clientX: number
  clientY: number
}

interface GridBounds {
  left: number
  top: number
  width: number
  height: number
}

/** Shared by artwork and port hit-testing; never changes the logical footprint. */
export const MACHINE_BODY_INSET = 3

/** Project a cell between station-local spaces through their snapped world origins. */
export function cellInStation(cell: { x: number; y: number }, source: BaseStation, target: BaseStation) {
  return {
    x: cell.x + (source.position.x - target.position.x) / CELL_SIZE,
    y: cell.y + (source.position.y - target.position.y) / CELL_SIZE,
  }
}

export function dronePortAnchor(point: ClientPoint, bounds: GridBounds, station: BaseStation): RouteAnchor | null {
  if (station.type !== 'drone_station') return null
  const size = STATION_TYPES.drone_station.footprintCells * CELL_SIZE
  const scale = bounds.width / size
  for (const port of droneOutputPorts(station)) {
    const localX = port.x - station.position.x / CELL_SIZE
    const dx = point.clientX - (bounds.left + (localX + 0.5) * CELL_SIZE * scale)
    const dy = point.clientY - (bounds.top + size * scale)
    if (dx * dx + dy * dy <= 15 * 15) {
      return { kind: 'port', x: localX, y: STATION_TYPES.drone_station.footprintCells, face: 'south', role: 'output' }
    }
  }
  return null
}

export function gridCell(point: ClientPoint, bounds: GridBounds, size: number) {
  const x = Math.floor(((point.clientX - bounds.left) / bounds.width) * size)
  const y = Math.floor(((point.clientY - bounds.top) / bounds.height) * size)
  return { x, y }
}

export function portPosition(machine: BasePlacement, port: MachinePort) {
  const footprint = PLACEABLES[machine.type]
  switch (port.face) {
    case 'north':
      return { left: (port.offset + 0.5) * CELL_SIZE, top: MACHINE_BODY_INSET }
    case 'east':
      return { left: footprint.width * CELL_SIZE - MACHINE_BODY_INSET, top: (port.offset + 0.5) * CELL_SIZE }
    case 'south':
      return { left: (port.offset + 0.5) * CELL_SIZE, top: footprint.height * CELL_SIZE - MACHINE_BODY_INSET }
    case 'west':
      return { left: MACHINE_BODY_INSET, top: (port.offset + 0.5) * CELL_SIZE }
  }
}

/** A port is easier to select than its visible 7px mark; routing still begins on the adjacent free cell. */
export function getPortAnchor(
  point: ClientPoint,
  bounds: GridBounds,
  placements: readonly BasePlacement[],
  size: number,
  canTraverse: CanTraverseEdge,
): RouteAnchor | null {
  const scaleX = bounds.width / (size * CELL_SIZE)
  const scaleY = bounds.height / (size * CELL_SIZE)
  let nearest: { anchor: RouteAnchor; distance: number } | null = null
  for (const machine of placements) {
    if (isSplitterType(machine.type)) {
      for (const face of ['north', 'east', 'south', 'west'] as const) {
        const [edgeX, edgeY] = edgePoints[face]
        const dx = point.clientX - (bounds.left + (machine.x * CELL_SIZE + edgeX) * scaleX)
        const dy = point.clientY - (bounds.top + (machine.y * CELL_SIZE + edgeY) * scaleY)
        const distance = dx * dx + dy * dy
        if (distance > 14 * 14 || (nearest && distance >= nearest.distance)) continue
        if (!canTraverse(machine.x, machine.y, face)) continue
        const [stepX, stepY] = faceSteps[face]
        nearest = {
          anchor: {
            kind: 'port',
            x: machine.x + stepX,
            y: machine.y + stepY,
            face,
            role: face === beltIncoming(machine) ? 'input' : 'output',
          },
          distance,
        }
      }
      continue
    }
    if (PLACEABLES[machine.type].category !== 'machine') continue
    for (const port of machinePorts(machine)) {
      const position = portPosition(machine, port)
      const dx = point.clientX - (bounds.left + (machine.x * CELL_SIZE + position.left) * scaleX)
      const dy = point.clientY - (bounds.top + (machine.y * CELL_SIZE + position.top) * scaleY)
      const distance = dx * dx + dy * dy
      if (distance > 14 * 14 || (nearest && distance >= nearest.distance)) continue
      if (!canAccessMachinePort(machine, port, canTraverse)) continue
      const cell = portOutsideCell(machine, port)
      nearest = { anchor: { kind: 'port', ...cell, face: port.face }, distance }
    }
  }
  return nearest?.anchor ?? null
}

export const edgePoints: Record<Direction, readonly [number, number]> = {
  west: [0, 10],
  east: [20, 10],
  north: [10, 0],
  south: [10, 20],
}
export const faceSteps: Record<Direction, readonly [number, number]> = {
  west: [-1, 0],
  east: [1, 0],
  north: [0, -1],
  south: [0, 1],
}

/** An unfinished route can be extended from its output or joined at its input. */
export function beltEndAnchor(
  occupied: OccupiedCells,
  x: number,
  y: number,
  type: EditorTool,
  role: 'input' | 'output',
  canTraverse: CanTraverseEdge,
): RouteAnchor | null {
  const belt = occupied.get(`${x},${y}`)
  if (!belt || belt.type !== type || !belt.routeId) return null
  const face = role === 'output' ? belt.direction : beltIncoming(belt)
  if (beltConnection(occupied, belt, face, canTraverse) || !canTraverse(belt.x, belt.y, face)) return null
  const [dx, dy] = faceSteps[face]
  return { kind: 'port', x: belt.x + dx, y: belt.y + dy, face, role, routeId: belt.routeId }
}

/** A side click on a straight belt targets its adjacent free cell, so the new route joins without overwriting the old one. */
export function beltJunctionAnchor(
  occupied: OccupiedCells,
  x: number,
  y: number,
  type: EditorTool,
  draft: RouteDraft | null,
  canTraverse: CanTraverseEdge,
  worldX: number,
  worldY: number,
): RouteAnchor | null {
  if (!draft || (type !== 'conveyor' && type !== 'conveyor_mk2')) return null
  const target = occupied.get(`${x},${y}`)
  if (!target || target.type !== type || !target.routeId) return null
  if (beltIncoming(target) !== oppositeDirection(target.direction)) return null
  const last = draft.anchors.at(-1)
  if (!last) return null
  const side: Direction =
    target.direction === 'east' || target.direction === 'west'
      ? last.y - worldY < target.y
        ? 'north'
        : 'south'
      : last.x - worldX < target.x
        ? 'west'
        : 'east'
  if (target.extraIncoming?.includes(side) || !canTraverse(target.x, target.y, side)) return null
  const [dx, dy] = faceSteps[side]
  const adjacent = { x: target.x + dx, y: target.y + dy }
  if (occupied.has(`${adjacent.x},${adjacent.y}`)) return null
  return { kind: 'port', ...adjacent, face: side, role: 'input', routeId: target.routeId, mergeTargetId: target.id }
}
