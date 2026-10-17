import type { Rotation, BuildingPort } from './buildings'
import type { Point, Scene, Selection } from './scene'

/** User-confirmed limits (2026-10-13), in items/min; the shared catalog has no logistics rates. */
const levels = {
  mk1: { marking: 'MK1', capacity: 60 },
  mk2: { marking: 'MK2', capacity: 120 },
} as const

/** Reference variants retain the approved shared artwork. */
export const BELTS = {
  conveyor: { ...levels.mk1, label: 'Belt MK1' },
  conveyor_mk2: { ...levels.mk2, label: 'Belt MK2' },
} as const

/** Splitter variants share fixed I/O geometry and the approved artwork. */
export const SPLITTERS = {
  splitter: { ...levels.mk1, label: 'Splitter' },
  splitter_mk2: { ...levels.mk2, label: 'Splitter Mk2' },
} as const
/** Reference reach counts buried cells, excluding both mouths; the shared catalog has no tunnel geometry. */
export const TUNNELS = {
  underground: { ...levels.mk1, label: 'Underground Belt', reach: 6 },
  underground_mk2: { ...levels.mk2, label: 'Underground Belt Mk2', reach: 8 },
} as const

const splitterFaceKeys = ['east', 'south', 'west', 'north'] as const

/** Rotation-zero permission keys exclude the splitter's fixed west input. */
export const SPLITTER_OUTPUT_KEYS: readonly string[] = splitterFaceKeys.filter((key) => key !== 'west')

/** The complete tunnel owns one switch; neither mouth is independently configurable. */
export const TUNNEL_OUTPUT_KEYS = ['exit'] as const

const variants = { ...BELTS, ...SPLITTERS, ...TUNNELS }

/** Validated IDs resolve their own nominal limit; only legacy belts omit their type and default to MK1. */
export function logisticsCapacity(type: keyof typeof variants | undefined): number {
  return variants[type ?? 'conveyor'].capacity
}

/** One cell with one fixed input and three outputs; rotation zero receives from the west. */
export interface Splitter extends Point {
  id: string
  type: keyof typeof SPLITTERS
  rotation: Rotation
  /** Output faces in rotation-zero coordinates; the west input has no switch. */
  disabledOutputs?: readonly string[]
}

/** A whole directed tunnel, never two independently editable mouths. */
export interface Tunnel {
  id: string
  type: keyof typeof TUNNELS
  entry: Point
  exit: Point
  disabledOutputs?: readonly string[]
}

/** Fixed faces reuse the canvas port geometry, but cannot switch between input and output. */
export interface LogisticsPort extends BuildingPort {
  owner: Selection
  at: Point
  role: 'input' | 'output'
}

/** Cardinal direction of a rotated splitter's straight-through lane. */
export function splitterHeading(rotation: Rotation): Point {
  return [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][rotation / 90]
}

/** Straight tunnels have at least one buried cell and a variant-specific maximum; invalid proposals allocate nothing. */
export function tunnelCells(tunnel: Omit<Tunnel, 'id'>): Point[] | null {
  const { entry, exit } = tunnel
  if (![entry.x, entry.y, exit.x, exit.y].every(Number.isSafeInteger) || (entry.x !== exit.x && entry.y !== exit.y)) return null
  const distance = Math.abs(exit.x - entry.x) + Math.abs(exit.y - entry.y)
  if (distance < 2 || distance > TUNNELS[tunnel.type].reach + 1) return null
  const heading = { x: Math.sign(exit.x - entry.x), y: Math.sign(exit.y - entry.y) }
  return Array.from({ length: distance + 1 }, (_, i) => ({ x: entry.x + heading.x * i, y: entry.y + heading.y * i }))
}

/** A logistics port owns an outside belt cell and a boundary point, just like a building port. */
function face(owner: Selection, at: Point, normal: Point, role: LogisticsPort['role']): LogisticsPort {
  return {
    owner,
    at,
    normal,
    role,
    key: `${at.x},${at.y}:${normal.x},${normal.y}`,
    cell: { x: at.x + normal.x, y: at.y + normal.y },
    position: { x: at.x + 0.5 + normal.x * 0.5, y: at.y + 0.5 + normal.y * 0.5 },
  }
}

/** Derive fixed I/O from confirmed geometry; no connection IDs are stored. */
export function logisticsPorts(scene: Pick<Scene, 'splitters' | 'tunnels'>): LogisticsPort[] {
  const ports: LogisticsPort[] = []
  for (const splitter of scene.splitters ?? []) {
    const heading = splitterHeading(splitter.rotation)
    for (const [index, normal] of [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ].entries()) {
      const port = face(
        { kind: 'splitter', id: splitter.id },
        splitter,
        normal,
        normal.x === -heading.x && normal.y === -heading.y ? 'input' : 'output',
      )
      const outputKey = splitterFaceKeys[(index - splitter.rotation / 90 + 4) % 4]
      ports.push(port.role === 'input' ? port : { ...port, outputKey, outputEnabled: !splitter.disabledOutputs?.includes(outputKey) })
    }
  }
  for (const tunnel of scene.tunnels ?? []) {
    const heading = { x: Math.sign(tunnel.exit.x - tunnel.entry.x), y: Math.sign(tunnel.exit.y - tunnel.entry.y) }
    const owner: Selection = { kind: 'tunnel', id: tunnel.id }
    ports.push(face(owner, tunnel.entry, { x: -heading.x, y: -heading.y }, 'input'), {
      ...face(owner, tunnel.exit, heading, 'output'),
      outputKey: TUNNEL_OUTPUT_KEYS[0],
      outputEnabled: !tunnel.disabledOutputs?.includes(TUNNEL_OUTPUT_KEYS[0]),
    })
  }
  return ports
}
