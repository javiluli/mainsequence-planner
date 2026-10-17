import { buildingPorts, type Building, type BuildingPort } from '../model/buildings'
import {
  SPLITTERS,
  TUNNELS,
  SPLITTER_OUTPUT_KEYS,
  TUNNEL_OUTPUT_KEYS,
  logisticsPorts,
  type Splitter,
  type Tunnel,
} from '../model/logistics'
import { DRONE_OUTPUT_KEYS, type Scene, type Selection, type Station } from '../model/scene'
import { dronePorts } from './stations'

/** The same local keys validate persistence and proposals; geometry never becomes a permission identity. */
export function outputKeys(
  piece: Omit<Building, 'id'> | Omit<Splitter, 'id'> | Omit<Tunnel, 'id'> | Omit<Station, 'id'>,
): readonly string[] {
  if ('stationId' in piece) return buildingPorts(piece).map((port) => port.key)
  if (piece.type === 'drone') return DRONE_OUTPUT_KEYS
  if (piece.type !== undefined && Object.hasOwn(SPLITTERS, piece.type)) return SPLITTER_OUTPUT_KEYS
  if (piece.type !== undefined && Object.hasOwn(TUNNELS, piece.type)) return TUNNEL_OUTPUT_KEYS
  return []
}

/** Reject unknown or duplicated switches rather than silently losing saved permissions. */
export function validDisabledOutputs(value: unknown, keys: readonly string[]): value is readonly string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((key) => typeof key === 'string' && keys.includes(key)) && new Set(value).size === value.length)
  )
}

/** Ports for one explicit actor, preserving fixed roles and local keys for keyboard controls. */
export function portsForSelection(
  scene: Scene,
  target: Selection,
): (BuildingPort & { role?: 'input' | 'output'; itemId?: string | null })[] {
  if (target.kind === 'building') {
    const building = scene.buildings.find((piece) => piece.id === target.id)
    return building ? buildingPorts(building) : []
  }
  if (target.kind === 'station') {
    const station = scene.stations.find((piece) => piece.id === target.id)
    return station ? dronePorts(station).map((port) => ({ ...port, role: 'output' as const })) : []
  }
  if (target.kind === 'belt') return []
  return logisticsPorts(scene).filter((port) => port.owner.kind === target.kind && port.owner.id === target.id)
}

/** One output update changes only its actor; no-ops, stale targets and input-only keys produce no transaction. */
export function proposePortOutput(scene: Scene, target: Selection, key: string, enabled: boolean): Partial<Scene> | null {
  if (typeof enabled !== 'boolean') return null
  const port = portsForSelection(scene, target).find((candidate) => candidate.outputKey === key)
  if (!port || (port.outputEnabled !== false) === enabled) return null
  const change = <T extends { disabledOutputs?: readonly string[] }>(piece: T): T => {
    const next = { ...piece },
      keys = new Set(piece.disabledOutputs)
    if (enabled) keys.delete(key)
    else keys.add(key)
    if (keys.size) next.disabledOutputs = [...keys].sort()
    else delete next.disabledOutputs
    return next
  }
  switch (target.kind) {
    case 'building':
      return { buildings: scene.buildings.map((piece) => (piece.id === target.id ? change(piece) : piece)) }
    case 'splitter':
      return { splitters: scene.splitters?.map((piece) => (piece.id === target.id ? change(piece) : piece)) }
    case 'tunnel':
      return { tunnels: scene.tunnels?.map((piece) => (piece.id === target.id ? change(piece) : piece)) }
    case 'station':
      return { stations: scene.stations.map((piece) => (piece.id === target.id && piece.type === 'drone' ? change(piece) : piece)) }
    case 'belt':
      return null
  }
}
