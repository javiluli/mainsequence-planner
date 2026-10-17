import { buildingPorts, type BuildingPort } from '../model/buildings'
import { logisticsPorts } from '../model/logistics'
import { CELL_SIZE, type Point, type Scene } from '../model/scene'
import { dronePorts } from './stations'

/** Index sockets and one-cell logistics housings once per layout edit; hover visits only its current cell. */
export function indexBeltPorts(
  scene: Pick<Scene, 'buildings' | 'stations' | 'splitters' | 'tunnels'>,
): ReadonlyMap<string, readonly BuildingPort[]> {
  const index = new Map<string, BuildingPort[]>()
  const fixed = logisticsPorts(scene)
  const ports = [...scene.buildings.flatMap(buildingPorts), ...fixed, ...scene.stations.flatMap(dronePorts)]
  const add = (cell: Point, port: BuildingPort) => {
    const key = `${cell.x},${cell.y}`,
      entries = index.get(key) ?? []
    entries.push(port)
    index.set(key, entries)
  }
  for (const port of ports) add(port.cell, port)
  for (const port of fixed) add(port.at, port)
  return index
}

/** A direct hit wins; proximity inside a logistics housing resolves to its outside socket cell, keeping the cursor free. */
export function resolveBeltPointer(
  ports: ReadonlyMap<string, readonly BuildingPort[]>,
  world: Point,
  directCell?: Point,
  directNormal?: Point,
): { point: Point; normal?: Point } {
  if (directCell && directNormal) return { point: directCell, normal: directNormal }
  const point = directCell ?? { x: Math.floor(world.x / CELL_SIZE), y: Math.floor(world.y / CELL_SIZE) }
  let nearest: BuildingPort | undefined,
    distance = Infinity,
    tied = false
  for (const port of ports.get(`${point.x},${point.y}`) ?? []) {
    const next = (world.x / CELL_SIZE - port.position.x) ** 2 + (world.y / CELL_SIZE - port.position.y) ** 2
    if (next < distance - 1e-9) {
      nearest = port
      distance = next
      tied = false
    } else if (Math.abs(next - distance) <= 1e-9) tied = true
  }
  // A central click between sockets has no source priority; the destination click can establish its direction.
  return !tied && nearest ? { point: nearest.cell, normal: nearest.normal } : { point }
}
