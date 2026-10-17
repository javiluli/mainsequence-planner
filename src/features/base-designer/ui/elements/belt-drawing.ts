import { CELL_SIZE, type Point, type Scene } from '../../model/scene'
import { logisticsPorts } from '../../model/logistics'
import type { BeltNetwork, BeltPortBridge } from '../../lib/belt-network'
import { containsBeltCell, samePoint } from '../../lib/belts'
import type { WorldBounds } from '../canvas/viewport'
import { beltBridgePixels, beltRenderGeometry, roundedBeltPath } from './belt-geometry'
import { insetPortPixel, PORT_INSERT } from './port-geometry'

/** Prepare attachment handovers before compiling tracks, so a socket bend never paints its slats twice.
 * The caller memoizes this confirmed snapshot; input scene/network collections are never mutated.
 */
export function prepareBeltConnections(scene: Pick<Scene, 'belts' | 'splitters' | 'tunnels'>, network: BeltNetwork) {
  const bridgesByBelt = new Map<string, BeltPortBridge[]>()
  for (const bridge of network.portBridges) {
    if (!bridge.beltId) continue
    if (!bridgesByBelt.has(bridge.beltId)) bridgesByBelt.set(bridge.beltId, [])
    bridgesByBelt.get(bridge.beltId)?.push(bridge)
  }
  const attachments = network.attachments.map((path) => {
    const [from, to] = path.points
    const source = scene.belts.find((b) => containsBeltCell(b.points, to)),
      target = scene.belts.find((b) => samePoint(b.points.at(-1)!, from)),
      belt = source ?? target
    const pixels = path.points.flatMap((p) => [(p.x + 0.5) * CELL_SIZE, (p.y + 0.5) * CELL_SIZE])
    let offset = 0
    if (belt) {
      const cell = source ? to : from,
        position = { x: (from.x + to.x + 1) / 2, y: (from.y + to.y + 1) / 2 },
        port = insetPortPixel(cell, position)
      const bridge: BeltPortBridge = {
        owner: path.owner,
        beltId: belt.id,
        cell,
        position,
        role: source ? 'output' : 'input',
        active: path.active,
      }
      const ports = bridgesByBelt.get(belt.id) ?? []
      ports.push(bridge)
      bridgesByBelt.set(belt.id, ports)
      // Hand over at the socket, not the belt cell center: painting both paths through a bend doubles its slats.
      if (source) pixels.splice(-2, 2, port.x, port.y)
      else {
        pixels.splice(0, 2, port.x, port.y)
        offset = CELL_SIZE / 2 + PORT_INSERT
      }
    }
    return {
      ...path,
      beltId: belt?.id,
      geometry: [roundedBeltPath(pixels, offset).map((section) => ({ ...section, active: path.active }))],
      bounds: routeBounds(path.points),
    }
  })
  return {
    bridgesByBelt,
    attachments,
    junctions: network.junctions.map(({ cell }) => cell),
    fixed: logisticsPorts({ splitters: scene.splitters, tunnels: scene.tunnels }),
  }
}

/** Compile complete route contours, pixel bounds, label normals and free caps from the prepared connections.
 * Connection order and source preference retain the exact socket handover and clock phase.
 */
export function prepareBeltTracks(belts: Scene['belts'], network: BeltNetwork, connections: ReturnType<typeof prepareBeltConnections>) {
  return belts.map((belt) => {
    const bridges = connections.bridgesByBelt.get(belt.id)
    const geometry = beltRenderGeometry(belt.points, belt.heading, bridges, network.runs.get(belt.id), connections.junctions)
    const source = bridges?.find((bridge) => bridge.role === 'output' && samePoint(bridge.cell, belt.points[0])),
      normal = source
        ? { x: Math.sign(source.cell.x + 0.5 - source.position.x), y: Math.sign(source.cell.y + 0.5 - source.position.y) }
        : belt.heading
    let left = Infinity,
      top = Infinity,
      right = -Infinity,
      bottom = -Infinity
    for (const p of belt.points) {
      left = Math.min(left, p.x)
      top = Math.min(top, p.y)
      right = Math.max(right, p.x + 1)
      bottom = Math.max(bottom, p.y + 1)
    }
    const bounds: WorldBounds = {
      x: left * CELL_SIZE,
      y: top * CELL_SIZE,
      width: (right - left) * CELL_SIZE,
      height: (bottom - top) * CELL_SIZE,
    }
    const caps = [belt.points[0], belt.points.at(-1)!].flatMap((cell, index) => {
      const role = index === 0 ? 'output' : 'input'
      if (
        bridges?.some((bridge) => bridge.role === role && samePoint(bridge.cell, cell)) ||
        connections.junctions.some((junction) => samePoint(junction, cell)) ||
        connections.fixed.some((port) => port.role === role && samePoint(port.at, cell) && network.connectedPorts.has(port.key))
      )
        return []
      const neighbor = index === 0 ? belt.points[1] : belt.points.at(-2)
      const direction = neighbor
        ? { x: Math.sign(cell.x - neighbor.x), y: Math.sign(cell.y - neighbor.y) }
        : { x: (index === 0 ? -1 : 1) * (belt.heading?.x ?? 1), y: (index === 0 ? -1 : 1) * (belt.heading?.y ?? 0) }
      return [
        {
          index,
          key: `end-${index}`,
          cell,
          normal: direction,
          position: { x: cell.x + 0.5 + direction.x / 2, y: cell.y + 0.5 + direction.y / 2 },
        },
      ]
    })
    return { belt, geometry, bounds, normal, caps }
  })
}

/** Compile physical port bridges with no owning belt, retaining their activity and insertion phase. */
export function preparePortBridges(ports: BeltNetwork['portBridges']) {
  return ports
    .filter((bridge) => !bridge.beltId)
    .map((bridge) => ({
      ...bridge,
      geometry: [
        roundedBeltPath(beltBridgePixels(bridge), bridge.role === 'output' ? -(CELL_SIZE / 2 + PORT_INSERT) : 0).map((section) => ({
          ...section,
          active: bridge.active,
        })),
      ],
    }))
}

/** Pixel bounds include full endpoint cells for attachments and thumbnails; they never redefine grid footprints. */
export function routeBounds(points: readonly Point[]): WorldBounds {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y)
  return {
    x: Math.min(...xs) * CELL_SIZE,
    y: Math.min(...ys) * CELL_SIZE,
    width: (Math.max(...xs) - Math.min(...xs) + 1) * CELL_SIZE,
    height: (Math.max(...ys) - Math.min(...ys) + 1) * CELL_SIZE,
  }
}
