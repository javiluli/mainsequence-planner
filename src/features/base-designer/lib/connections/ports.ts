import { PLACEABLES, type Direction, type PlaceableType } from '../../model/catalog'
import type { BasePlacement } from '../layout/placement'

/** One-cell displacement in the placement coordinate frame: east is +x and south is +y, independent of viewport scale. */
export const directionSteps: Record<Direction, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
}

export interface MachinePort {
  face: Direction
  offset: number
}

export function machinePortKey(port: MachinePort): string {
  return `${port.face}:${port.offset}`
}

const faces: Direction[] = ['north', 'east', 'south', 'west']

// These cell offsets are measured by the player in-game, not inferred from recipe data.
const portOffsets: Partial<Record<PlaceableType, readonly number[]>> = {
  reactor: [2, 3],
  refinery: [1],
  assembler: [1, 3],
  material_lab: [1],
  container: [0, 1],
  enrichment: [2, 4, 6],
  computation_lab: [1],
}

/** Derive physical openings from footprint orientation; product/recipe assignment does not create or remove ports. */
export function machinePorts(placement: BasePlacement): MachinePort[] {
  if (PLACEABLES[placement.type].category !== 'machine') return []
  const offsets = portOffsets[placement.type] ?? []
  const activeFaces = placement.type === 'material_lab' || placement.type === 'computation_lab' ? [placement.direction] : faces
  return activeFaces.flatMap((face) => offsets.map((offset) => ({ face, offset })))
}

/** Cell immediately outside an opening, where a directed logistics piece can connect. */
export function portOutsideCell(placement: BasePlacement, port: MachinePort): { x: number; y: number } {
  const { width, height } = PLACEABLES[placement.type]
  switch (port.face) {
    case 'north':
      return { x: placement.x + port.offset, y: placement.y - 1 }
    case 'east':
      return { x: placement.x + width, y: placement.y + port.offset }
    case 'south':
      return { x: placement.x + port.offset, y: placement.y + height }
    case 'west':
      return { x: placement.x - 1, y: placement.y + port.offset }
  }
}

export function oppositeDirection(direction: Direction): Direction {
  return faces[(faces.indexOf(direction) + 2) % faces.length]
}

export function rotateDirection(direction: Direction): Direction {
  return faces[(faces.indexOf(direction) + 1) % faces.length]
}

/** Output settings follow physical ports; east/west offsets reverse when they turn onto horizontal faces. */
export function rotateDisabledOutputPorts(placement: BasePlacement): string[] | undefined {
  if (!placement.disabledOutputPorts?.length) return undefined
  const disabled = new Set(placement.disabledOutputPorts)
  const rotated = machinePorts(placement)
    .filter((port) => disabled.has(machinePortKey(port)))
    .map((port) => {
      const offset = port.face === 'east' || port.face === 'west' ? PLACEABLES[placement.type].height - 1 - port.offset : port.offset
      return machinePortKey({ face: rotateDirection(port.face), offset })
    })
  return rotated.length ? rotated : undefined
}
