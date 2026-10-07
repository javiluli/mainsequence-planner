import { indexPlacements, type BaseStation } from './placement'
import { neighboringPlacements, worldPlacements } from './world-layout'
import { canCrossStationBoundary, connectedCorridors, droneOutputPorts } from './stations'
import { connectedProductionBelts, withBuriedBeltFlows } from '../connections/belt-flow'
import { surfaceBeltPortRole, type CanTraverseEdge } from '../connections/connections'
import { directionSteps, oppositeDirection } from '../connections/ports'

/**
 * Derive one world-cell render snapshot from confirmed stations or their movement proposal.
 * Surface occupancy excludes buried cells; animation extends only confirmed phases to buried artwork.
 * Consumers must memoize by the station snapshot, not pointer/viewport state or individual nodes.
 */
export function createLayoutView(stations: readonly BaseStation[]) {
  const worldPieces = worldPlacements(stations)
  const worldOccupied = indexPlacements(worldPieces)
  const corridors = connectedCorridors(stations)
  const neighborsByStation = new Map(stations.map((station) => [station.id, neighboringPlacements(station, corridors, worldPieces)]))
  const allDronePorts = stations.flatMap(droneOutputPorts)
  const dronePorts = allDronePorts.filter((port) => port.itemId)
  const droneSourceCells = new Set(
    allDronePorts
      .filter((port) => {
        const belt = worldOccupied.get(`${port.x},${port.y}`)
        return belt && surfaceBeltPortRole(belt, oppositeDirection(port.face)) === 'input'
      })
      .map((port) => `${port.x},${port.y}`),
  )
  const canTraverseWorld: CanTraverseEdge = (x, y, face) => {
    const [dx, dy] = directionSteps[face]
    return canCrossStationBoundary(stations, { x, y }, { x: x + dx, y: y + dy }, corridors)
  }
  const animatedBelts = withBuriedBeltFlows(worldPieces, connectedProductionBelts(worldPieces, worldOccupied, canTraverseWorld, dronePorts))
  return { worldPieces, worldOccupied, corridors, neighborsByStation, droneSourceCells, animatedBelts }
}
