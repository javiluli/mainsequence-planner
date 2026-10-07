import { PLACEABLES, isConveyorType, isSplitterType, isUndergroundType, type Direction } from '../../model/catalog'
import { machinePortKey, machinePorts, oppositeDirection, portOutsideCell, directionSteps as steps, type MachinePort } from './ports'
import type { BasePlacement } from '../layout/placement'

/** Surface occupancy in the caller's local/world cell frame; buried cells are intentionally excluded. */
export type OccupiedCells = ReadonlyMap<string, BasePlacement>

export type CanTraverseEdge = (x: number, y: number, face: Direction) => boolean

const faces: Direction[] = ['north', 'east', 'south', 'west']

export function beltIncoming(placement: BasePlacement): Direction {
  return placement.incoming ?? oppositeDirection(placement.direction)
}

/** A splitter receives on one face and can send to each of the other three. */
export function beltOutputs(placement: BasePlacement): Direction[] {
  const incoming = beltIncoming(placement)
  return isSplitterType(placement.type) ? faces.filter((face) => face !== incoming) : [placement.direction]
}

/** Valid tunnels expose only the inlet's input and outlet's output; other faces belong to the buried passage. */
export function surfaceBeltPortRole(placement: BasePlacement, face: Direction): 'input' | 'output' | null {
  if (placement.buried || PLACEABLES[placement.type].category !== 'logistics') return null
  if (isUndergroundType(placement.type)) {
    // A missing index denotes the inlet in single-cell previews; committed tunnels have ordered indices.
    if ((placement.routeIndex ?? 0) === 0) return face === beltIncoming(placement) ? 'input' : null
    return face === placement.direction ? 'output' : null
  }
  if (face === beltIncoming(placement) || placement.extraIncoming?.includes(face)) return 'input'
  return beltOutputs(placement).includes(face) ? 'output' : null
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

/** Normal belts accept lateral machine outputs without storing a junction in either placement.
 * A face delivering into a machine stays an input for that machine. Tunnels and splitters keep their explicit mouths.
 */
export function beltInputFaces(occupied: OccupiedCells, belt: BasePlacement, canTraverse?: CanTraverseEdge): Direction[] {
  const inputs = [beltIncoming(belt), ...(belt.extraIncoming ?? [])]
  if (!isConveyorType(belt.type) || belt.buried) return inputs.filter((face) => surfaceBeltPortRole(belt, face) === 'input')
  for (const face of faces) {
    if (face === belt.direction || inputs.includes(face)) continue
    const neighbor = neighborAt(occupied, belt, face, canTraverse)
    if (neighbor && PLACEABLES[neighbor.type].category === 'machine' && machineHasPort(neighbor, belt, true)) inputs.push(face)
  }
  return inputs
}

/**
 * Resolve a directed neighbor using placements, occupancy and traversal in the same cell frame.
 * Normal belts also receive enabled lateral machine output; that derived face never mutates the layout.
 */
export function beltConnection(
  occupied: OccupiedCells,
  belt: BasePlacement,
  face: Direction,
  canTraverse?: CanTraverseEdge,
): BasePlacement | undefined {
  const role = surfaceBeltPortRole(belt, face) ?? (beltInputFaces(occupied, belt, canTraverse).includes(face) ? 'input' : null)
  if (!role) return undefined
  const neighbor = neighborAt(occupied, belt, face, canTraverse)
  if (!neighbor) return undefined
  if (PLACEABLES[neighbor.type].category === 'machine') {
    return machineHasPort(neighbor, belt, role === 'input') ? neighbor : undefined
  }
  const neighborRole = surfaceBeltPortRole(neighbor, oppositeDirection(face))
  return neighborRole && neighborRole !== role ? neighbor : undefined
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
  const role = surfaceBeltPortRole(belt, beltFace)
  if (role === 'output') return 'input'
  // Disabled outputs still expose blocked feedback, even though they no longer contribute a derived belt input.
  if (role === 'input' || (isConveyorType(belt.type) && !belt.buried))
    return machine.disabledOutputPorts?.includes(machinePortKey(port)) ? 'disabled-output' : 'output'
  return null
}
