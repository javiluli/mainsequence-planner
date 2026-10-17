import { buildingPorts, type BuildingPort } from '../model/buildings'
import { STATION_CELLS, type Belt, type Point, type Scene } from '../model/scene'
import { logisticsPorts, type LogisticsPort } from '../model/logistics'
import { dronePorts, floorCellLimit } from './stations'

/** Compare coordinates exactly; callers establish the coordinate space and validate grid positions. */
export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

/** One cardinal step, never a diagonal or a fractional direction. */
export function isBeltHeading(point: Point): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y) && Math.abs(point.x) + Math.abs(point.y) === 1
}

/** Passing belts collect outputs; a terminal delivers head-on or laterally, never away from its port. */
export function beltPortRole(port: BuildingPort, previous?: Point, next?: Point, heading?: Point): 'input' | 'output' | undefined {
  const incoming = previous ? { x: Math.sign(port.cell.x - previous.x), y: Math.sign(port.cell.y - previous.y) } : heading
  const outgoing = next ? { x: Math.sign(next.x - port.cell.x), y: Math.sign(next.y - port.cell.y) } : heading
  const toward = { x: -port.normal.x, y: -port.normal.y }
  if (!next && incoming && !samePoint(incoming, port.normal)) return 'input'
  // A lane approaching the hull and turning away does not also collect from that same face.
  if (previous && next && incoming && samePoint(incoming, toward)) return undefined
  if (outgoing && !samePoint(outgoing, toward)) return 'output'
  return undefined
}

/** Resolve all ports sharing one cell together: multiple terminal recipients become outputs, without a machine priority. */
export function resolveBeltPorts(
  ports: readonly { buildingId: string; port: BuildingPort }[],
  previous?: Point,
  next?: Point,
  heading?: Point,
): { buildingId: string; port: BuildingPort; role: 'input' | 'output' }[] {
  const connections = ports.flatMap((connection) => {
    const role = beltPortRole(connection.port, previous, next, heading)
    return role ? [{ ...connection, role }] : []
  })
  if (connections.filter(({ role }) => role === 'input').length > 1) for (const connection of connections) connection.role = 'output'
  return connections
}

/** Test committed orthogonal spans without expanding their cells during pointer hit feedback. */
export function containsBeltCell(points: readonly Point[], point: Point): boolean {
  return points.some((to, i) => {
    const from = points[Math.max(0, i - 1)]
    return (
      point.x >= Math.min(from.x, to.x) &&
      point.x <= Math.max(from.x, to.x) &&
      point.y >= Math.min(from.y, to.y) &&
      point.y <= Math.max(from.y, to.y)
    )
  })
}

/** Expand an orthogonal route within the available floor-area bound, rejecting loops before allocating more cells. */
export function beltCells(points: readonly Point[], maxCells = STATION_CELLS * STATION_CELLS): Point[] | null {
  if (!points.length || points.length > maxCells || points.some((p) => !Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y)))
    return null
  const first = points[0]
  const cells: Point[] = [{ ...first }]
  const visited = new Set([`${first.x},${first.y}`])
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1],
      to = points[i]
    const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
    if ((from.x !== to.x && from.y !== to.y) || distance === 0 || !Number.isSafeInteger(distance)) return null
    if (cells.length + distance > maxCells) return null
    const dx = Math.sign(to.x - from.x),
      dy = Math.sign(to.y - from.y)
    for (let step = 1; step <= distance; step++) {
      const cell = { x: from.x + dx * step, y: from.y + dy * step }
      const key = `${cell.x},${cell.y}`
      if (visited.has(key)) return null
      visited.add(key)
      cells.push(cell)
    }
  }
  return cells
}

/** A final cell may merge into a start, straight lane or corner, with distinct incoming arms and one outgoing arm. */
export function canJoinBelts(from: readonly Point[], to: readonly Point[], cell: Point, fromHeading?: Point, toHeading?: Point): boolean {
  if (from.length === 1 && to.length === 1) return false
  const end = from.at(-1),
    previous = from.at(-2) ?? (end && fromHeading ? { x: end.x - fromHeading.x, y: end.y - fromHeading.y } : undefined)
  const index = to.findIndex((p) => samePoint(p, cell)),
    // A fragment cut beside a junction still has a direction, even when it contains only that shared cell.
    next = to[index + 1] ?? (to.length === 1 && toHeading ? { x: cell.x + toHeading.x, y: cell.y + toHeading.y } : undefined)
  if (!end || !previous || !samePoint(end, cell) || index < 0 || !next) return false
  if (index === 0) return !samePoint(previous, next)
  const before = to[index - 1]
  return !samePoint(previous, before) && !samePoint(previous, next)
}

/** Cutting just after a T leaves two terminal routes whose single continuation is the fixed input socket. */
export function joinsAtLogisticsInput(
  port: LogisticsPort,
  a: readonly Point[],
  b: readonly Point[],
  headingA?: Point,
  headingB?: Point,
): boolean {
  if (port.role !== 'input' || !a.length || !b.length || !samePoint(a.at(-1)!, port.cell) || !samePoint(b.at(-1)!, port.cell)) return false
  if (!connectsLogisticsPort(port, a, headingA) || !connectsLogisticsPort(port, b, headingB)) return false
  const previousA = a.at(-2) ?? (headingA && { x: port.cell.x - headingA.x, y: port.cell.y - headingA.y })
  const previousB = b.at(-2) ?? (headingB && { x: port.cell.x - headingB.x, y: port.cell.y - headingB.y })
  return (
    !!previousA &&
    !!previousB &&
    (!samePoint(previousA, previousB) ||
      canJoinBelts(a, b, port.cell, headingA, headingB) ||
      canJoinBelts(b, a, port.cell, headingB, headingA))
  )
}

/** Fixed inputs receive at endpoints; outputs also supply passing lanes through their outside cell, never through the hull. */
export function connectsLogisticsPort(port: LogisticsPort, cells: readonly Point[], heading?: Point): boolean {
  if (port.role === 'output') {
    const index = cells.findIndex((cell) => samePoint(cell, port.cell))
    // Fixed outlets can feed head-on corners; legacy routes starting at the mouth still need the axial check below.
    if (index > 0 && index < cells.length - 1 && !samePoint(cells[0], port.at))
      return !samePoint(cells[index - 1], port.at) && !samePoint(cells[index + 1], port.at)
  }
  const end = port.role === 'input' ? cells.at(-1) : cells[0]
  if (!end || (!samePoint(end, port.cell) && !samePoint(end, port.at))) return false
  const neighbor = port.role === 'input' ? cells.at(-2) : cells[1]
  const direction = neighbor
    ? port.role === 'input'
      ? { x: end.x - neighbor.x, y: end.y - neighbor.y }
      : { x: neighbor.x - end.x, y: neighbor.y - end.y }
    : heading
  const normal = port.role === 'input' ? { x: -port.normal.x, y: -port.normal.y } : port.normal
  // Legacy mouth-center routes stay axial; outside endpoints turn within their own cell before entering the socket.
  return !!direction && (samePoint(end, port.at) ? samePoint(direction, normal) : direction.x * normal.x + direction.y * normal.y >= 0)
}

/** Starting on a free final anchor extends its existing identity; joined or building-connected outputs are occupied. */
export function beltToExtend(scene: Scene, point: Point): Belt | undefined {
  const belt = scene.belts.find((b) => b.points.at(-1) && samePoint(b.points[b.points.length - 1], point))
  if (!belt) return undefined
  const connections = beltConnections(scene, belt)
  if (connections.input || connections.logisticsInput) return undefined
  return scene.belts.some((other) => other.id !== belt.id && containsBeltCell(other.points, point)) ? undefined : belt
}

/** Endpoint gestures use the network's port rules; multiple outputs are never reduced to an arbitrary machine. */
export function beltConnections(
  scene: Scene,
  belt: Pick<Belt, 'points' | 'heading'> & { id?: string },
): {
  output?: { buildingId: string; port: BuildingPort }
  input?: { buildingId: string; port: BuildingPort }
  logisticsOutput?: LogisticsPort
  logisticsInput?: LogisticsPort
  droneOutput?: ReturnType<typeof dronePorts>[number]
} {
  const first = belt.points[0],
    second = belt.points[1],
    last = belt.points.at(-1),
    previous = belt.points.at(-2)
  if (!first || !last) return {}
  const cells = beltCells(belt.points, floorCellLimit(scene.stations)) ?? []
  const fixed = logisticsPorts(scene).filter(
    (port) =>
      connectsLogisticsPort(port, cells, belt.heading) &&
      !scene.belts.some((other) => other.id !== belt.id && other.points !== belt.points && containsBeltCell(other.points, port.cell)),
  )
  // Endpoint gestures must not mistake a lateral provider for the route's initial socket.
  const logisticsOutput = fixed.find((p) => p.role === 'output' && (samePoint(p.cell, first) || samePoint(p.at, first))),
    logisticsInput = fixed.find((p) => p.role === 'input')
  // A route ending at fixed I/O continues through that piece: adjacent machine ports remain lateral providers.
  const continuation = logisticsInput ? { x: last.x - logisticsInput.normal.x, y: last.y - logisticsInput.normal.y } : undefined
  const ports = scene.buildings.flatMap((building) => buildingPorts(building).map((port) => ({ buildingId: building.id, port })))
  const outputs = resolveBeltPorts(
    ports.filter(({ port }) => samePoint(port.cell, first)),
    undefined,
    second ?? continuation,
    belt.heading,
  )
    .filter(({ role }) => role === 'output')
    .map(({ buildingId, port }) => ({ buildingId, port }))
  const inputs = resolveBeltPorts(
    ports.filter(({ port }) => samePoint(port.cell, last)),
    previous,
    continuation,
    belt.heading,
  )
    .filter(({ role }) => role === 'input')
    .map(({ buildingId, port }) => ({ buildingId, port }))
  let output = outputs.length === 1 ? outputs[0] : undefined
  let input = inputs.length === 1 ? inputs[0] : undefined
  for (const other of scene.belts) {
    if (other.id === belt.id || other.points === belt.points) continue
    if (output && containsBeltCell(other.points, first)) output = undefined
    if (input && containsBeltCell(other.points, last)) input = undefined
  }
  const droneOutput = scene.stations
    .flatMap(dronePorts)
    .find(
      (port) =>
        samePoint(port.cell, first) &&
        beltPortRole(port, undefined, second ?? continuation, belt.heading) === 'output' &&
        !scene.belts.some((other) => other.id !== belt.id && other.points !== belt.points && containsBeltCell(other.points, first)),
    )
  return { output, input, logisticsOutput, logisticsInput, droneOutput }
}
