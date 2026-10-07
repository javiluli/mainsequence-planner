import { PLACEABLES, isUndergroundType } from '../../model/catalog'
import { beltConnection, beltInputFaces, machinePortFlow } from '../connections/connections'
import { recipeForPlaceable, recipeOutputs } from './machine-recipes'
import { indexPlacements, type BasePlacement, type BaseStation } from '../layout/placement'
import { machinePorts, oppositeDirection, portOutsideCell } from '../connections/ports'
import { canCrossStationBoundary, connectedCorridors, droneOutputPorts } from '../layout/stations'
import { worldPlacements } from '../layout/world-layout'

/** Known upstream labels, not simulated contents, capacity, delivery or complete ingredient coverage. */
export function knownMachineInputItems(stations: readonly BaseStation[], placementId: string): ReadonlySet<string> {
  const pieces = worldPlacements(stations)
  const machine = pieces.find((piece) => piece.id === placementId)
  const items = new Set<string>()
  if (!machine) return items
  const occupied = indexPlacements(pieces)
  const corridors = connectedCorridors(stations)
  const canTraverse = (x: number, y: number, face: BasePlacement['direction']) => {
    const dx = face === 'east' ? 1 : face === 'west' ? -1 : 0
    const dy = face === 'south' ? 1 : face === 'north' ? -1 : 0
    return canCrossStationBoundary(stations, { x, y }, { x: x + dx, y: y + dy }, corridors)
  }
  const tunnelRoutes = new Map<string, BasePlacement[]>()
  for (const piece of pieces) {
    if (!piece.routeId || !isUndergroundType(piece.type)) continue
    const route = tunnelRoutes.get(piece.routeId) ?? []
    route.push(piece)
    tunnelRoutes.set(piece.routeId, route)
  }
  const entranceByExit = new Map<string, BasePlacement>()
  for (const route of tunnelRoutes.values()) {
    route.sort((a, b) => (a.routeIndex ?? 0) - (b.routeIndex ?? 0))
    if (route.length >= 3) entranceByExit.set(route[route.length - 1].id, route[0])
  }
  const dronePorts = stations.flatMap(droneOutputPorts)
  const pending: BasePlacement[] = [machine]
  const visited = new Set<string>()
  while (pending.length) {
    const piece = pending.pop()
    if (!piece || visited.has(piece.id)) continue
    visited.add(piece.id)
    if (PLACEABLES[piece.type].category === 'machine') {
      if (piece.id !== machine.id && piece.type !== 'container') {
        const recipe = recipeForPlaceable(piece.type, piece.recipeId)
        if (recipe) for (const output of recipeOutputs(recipe)) items.add(output.id)
        continue
      }
      // Storage relays possible incoming labels; unassigned producers do not invent their outputs.
      for (const port of machinePorts(piece)) {
        if (machinePortFlow(occupied, piece, port, canTraverse) !== 'input') continue
        const outside = portOutsideCell(piece, port)
        const belt = occupied.get(`${outside.x},${outside.y}`)
        if (belt && (!isUndergroundType(belt.type) || entranceByExit.has(belt.id))) pending.push(belt)
      }
      continue
    }
    const entrance = entranceByExit.get(piece.id)
    if (entrance) {
      // Jump below surface parts, rather than reading them as suppliers of the tunnel exit.
      pending.push(entrance)
      continue
    }
    for (const face of beltInputFaces(occupied, piece, canTraverse)) {
      const source = beltConnection(occupied, piece, face, canTraverse)
      if (source) pending.push(source)
      for (const port of dronePorts) {
        if (port.itemId && port.x === piece.x && port.y === piece.y && oppositeDirection(port.face) === face) {
          // Match the physical edge, including the derived doorway, without assigning a rate to cargo.
          const dx = port.face === 'east' ? 1 : port.face === 'west' ? -1 : 0
          const dy = port.face === 'south' ? 1 : port.face === 'north' ? -1 : 0
          if (canTraverse(port.x - dx, port.y - dy, port.face)) items.add(port.itemId)
        }
      }
    }
  }
  return items
}
