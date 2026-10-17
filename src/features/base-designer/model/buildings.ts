import type { Point } from './scene'

/** Measured footprints and physical openings, separate from Crafter recipes.
 * A null crafterId means no catalog recipe mapping; it does not rule out storage, energy or future lab behavior.
 */
export const BUILDINGS = {
  refinery: {
    category: 'Buildings',
    label: 'Refinery',
    marking: 'REFINERY',
    size: 3,
    offsets: [1],
    crafterId: 'refinery',
    singleFace: false,
  },
  assembler: {
    category: 'Buildings',
    label: 'Assembler',
    marking: 'ASSEMBLER',
    size: 5,
    offsets: [1, 3],
    crafterId: 'fabricator',
    singleFace: false,
  },
  /** Approved, pending implementation: consumes T_HydrogenFuel and generates MJ; fuel use and generation rates remain unknown. */
  reactor: { category: 'Power', label: 'Reactor', marking: 'REACTOR', size: 6, offsets: [2, 3], crafterId: null, singleFace: false },
  /** Lab functionality is reserved for future work; current support covers geometry and ports. */
  material_lab: {
    category: 'Buildings',
    label: 'Material Science Lab',
    marking: 'MAT. LAB',
    size: 3,
    offsets: [1],
    crafterId: null,
    singleFace: true,
  },
  /** Shares the current lab geometry contract; no science consumption or research behavior is defined yet. */
  computation_lab: {
    category: 'Buildings',
    label: 'Computation Science Lab',
    marking: 'COMP. LAB',
    size: 3,
    offsets: [1],
    crafterId: null,
    singleFace: true,
  },
  enrichment: {
    category: 'Buildings',
    label: 'Enrichment Chamber',
    marking: 'ENRICHMENT',
    size: 9,
    offsets: [2, 4, 6],
    crafterId: 'enrichment',
    singleFace: false,
  },
  /** Receives item types and nominal lane rates; no stored quantities, capacity limit or forwarding is inferred. */
  container: { category: 'Storage', label: 'Container', marking: 'BOX', size: 2, offsets: [0, 1], crafterId: null, singleFace: false },
} as const

export type BuildingType = keyof typeof BUILDINGS
export type Rotation = 0 | 90 | 180 | 270

/** Buildings keep world-cell ownership explicit; rotation never changes their logical footprint. */
export interface Building extends Point {
  id: string
  stationId: string
  type: BuildingType
  rotation: Rotation
  /** Concrete catalog recipe, including its variant; absence means no assignment. */
  recipeId?: string
  /** Local face keys; disabling supply never disables this port's receiving role. */
  disabledOutputs?: readonly string[]
}

/** Physical cell outside the footprint, with its outward direction and drawing position. */
export interface BuildingPort {
  key: string
  cell: Point
  normal: Point
  position: Point
  /** Stable local permission key, independent of position, rotation and copied IDs. */
  outputKey?: string
  outputEnabled?: boolean
}

/** Turn a building clockwise, retaining one of the four supported orientations. */
export function nextRotation(rotation: Rotation): Rotation {
  return rotation === 270 ? 0 : rotation === 180 ? 270 : rotation === 90 ? 180 : 90
}

/** Labs expose only their oriented face (south at zero); other reference machines expose all faces. Belts determine bidirectional flow roles. */
export function buildingPorts(building: Omit<Building, 'id'>): BuildingPort[] {
  const { size, offsets, singleFace } = BUILDINGS[building.type]
  const faces = [
    { normal: { x: 0, y: -1 }, cell: (offset: number) => ({ x: offset, y: -1 }) },
    { normal: { x: 1, y: 0 }, cell: (offset: number) => ({ x: size, y: offset }) },
    { normal: { x: 0, y: 1 }, cell: (offset: number) => ({ x: offset, y: size }) },
    { normal: { x: -1, y: 0 }, cell: (offset: number) => ({ x: -1, y: offset }) },
  ]
  return faces.flatMap((face, faceIndex) =>
    singleFace && faceIndex !== 2
      ? []
      : offsets.map((offset) => {
          let cell = face.cell(offset)
          let normal = face.normal
          for (let angle = 0; angle < building.rotation; angle += 90) {
            cell = { x: size - 1 - cell.y, y: cell.x }
            normal = { x: -normal.y, y: normal.x }
          }
          cell = { x: cell.x + building.x, y: cell.y + building.y }
          return {
            key: `${faceIndex}:${offset}`,
            outputKey: `${faceIndex}:${offset}`,
            outputEnabled: !building.disabledOutputs?.includes(`${faceIndex}:${offset}`),
            cell,
            normal,
            position: { x: cell.x + 0.5 - normal.x * 0.5, y: cell.y + 0.5 - normal.y * 0.5 },
          }
        }),
  )
}
