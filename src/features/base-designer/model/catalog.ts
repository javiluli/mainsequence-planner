/** La huella de 14×14/30×30 celdas es edificable completa; el marco visual queda fuera de ella. */
export const STATION_TYPES = {
  station_1x1: { label: 'Station 1×1', footprintCells: 14, gateStarts: [4], openFaces: ['north', 'east', 'south', 'west'] },
  station_2x2_a: { label: 'Station 2×2 A', footprintCells: 30, gateStarts: [4, 20], openFaces: ['north', 'east', 'south', 'west'] },
  station_2x2_b: { label: 'Station 2×2 B', footprintCells: 30, gateStarts: [4, 20], openFaces: ['north', 'east', 'south', 'west'] },
  drone_station: { label: 'Drone station', footprintCells: 14, gateStarts: [4], openFaces: ['south'] },
} as const

export type StationType = keyof typeof STATION_TYPES

export const PLACEABLES = {
  reactor: { label: 'Reactor', width: 6, height: 6, category: 'machine', paletteGroup: 'power' },
  refinery: { label: 'Refinery', width: 3, height: 3, category: 'machine', paletteGroup: 'production' },
  assembler: { label: 'Assembler', width: 5, height: 5, category: 'machine', paletteGroup: 'production' },
  material_lab: { label: 'Material Science Lab', width: 3, height: 3, category: 'machine', paletteGroup: 'production' },
  container: { label: 'Container', width: 2, height: 2, category: 'machine', paletteGroup: 'storage' },
  enrichment: { label: 'Enrichment Chamber', width: 9, height: 9, category: 'machine', paletteGroup: 'production' },
  computation_lab: { label: 'Computation Science Lab', width: 3, height: 3, category: 'machine', paletteGroup: 'production' },
  conveyor: { label: 'Conveyor Belt Mk. 1', width: 1, height: 1, category: 'logistics', paletteGroup: 'logistics', capacityPerMinute: 60 },
  conveyor_mk2: {
    label: 'Conveyor Belt Mk. 2',
    width: 1,
    height: 1,
    category: 'logistics',
    paletteGroup: 'logistics',
    capacityPerMinute: 120,
  },
  underground: {
    label: 'Underground Belt Mk. 1',
    width: 1,
    height: 1,
    category: 'logistics',
    paletteGroup: 'logistics',
    capacityPerMinute: 60,
  },
  underground_mk2: {
    label: 'Underground Belt Mk. 2',
    width: 1,
    height: 1,
    category: 'logistics',
    paletteGroup: 'logistics',
    capacityPerMinute: 120,
  },
  splitter: { label: 'Splitter Mk. 1', width: 1, height: 1, category: 'logistics', paletteGroup: 'logistics', capacityPerMinute: 60 },
  splitter_mk2: { label: 'Splitter Mk. 2', width: 1, height: 1, category: 'logistics', paletteGroup: 'logistics', capacityPerMinute: 120 },
} as const

export type PlaceableType = keyof typeof PLACEABLES
export type EditorTool = PlaceableType | 'select' | 'erase'
export type Direction = 'north' | 'east' | 'south' | 'west'
export type RouteTool = 'conveyor' | 'conveyor_mk2' | 'underground' | 'underground_mk2'
/** Visual pixels per build cell; one cell is one game floor square. */
export const CELL_SIZE = 20
export const STATION_GATE_CELLS = 6
export const STATION_CORRIDOR_CELLS = 2

export function isRouteTool(tool: EditorTool): tool is RouteTool {
  return tool === 'conveyor' || tool === 'conveyor_mk2' || tool === 'underground' || tool === 'underground_mk2'
}

export function isSplitterType(type: PlaceableType): boolean {
  return type === 'splitter' || type === 'splitter_mk2'
}

export function isUndergroundType(type: PlaceableType): type is 'underground' | 'underground_mk2' {
  return type === 'underground' || type === 'underground_mk2'
}

export function isConveyorType(type: PlaceableType): type is 'conveyor' | 'conveyor_mk2' {
  return type === 'conveyor' || type === 'conveyor_mk2'
}

export function isPlaceableTool(tool: EditorTool): tool is PlaceableType {
  return tool !== 'select' && tool !== 'erase'
}

export const MACHINE_TYPES = (Object.keys(PLACEABLES) as PlaceableType[]).filter((type) => PLACEABLES[type].category === 'machine')
export const LOGISTICS_TYPES = (Object.keys(PLACEABLES) as PlaceableType[]).filter((type) => PLACEABLES[type].category === 'logistics')
