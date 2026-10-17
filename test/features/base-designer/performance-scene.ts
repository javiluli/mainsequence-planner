import type { Scene } from '@/features/base-designer/model/scene'

/** Repeat the validated Konva profiling module: real Titanium recipe/cargo, inline splitters, one-cell branches and a buried route. */
export function performanceScene(modules: number): Required<Scene> {
  const scene: { [K in keyof Required<Scene>]: Required<Scene>[K][number][] } = {
    stations: [],
    buildings: [],
    belts: [],
    splitters: [],
    tunnels: [],
  }
  const columns = Math.ceil(Math.sqrt(modules))
  for (let module = 0; module < modules; module++) {
    const x = (module % columns) * 32,
      y = Math.floor(module / columns) * 48
    const floor = 'floor-' + module
    scene.stations.push(
      { id: floor, type: 'station_2x2_a', x, y },
      { id: 'drone-' + module, type: 'drone', x, y: y - 15, rotation: 0, cargo: ['T_TitaniumOre', null] },
    )
    scene.belts.push({
      id: 'feed-' + module,
      points: [
        { x: x + 6, y: y - 1 },
        { x: x + 6, y: y + 2 },
        { x, y: y + 2 },
        { x, y: y + 4 },
        { x: x + 25, y: y + 4 },
      ],
    })
    for (let machine = 0; machine < 4; machine++) {
      const at = x + 1 + machine * 6
      scene.buildings.push({
        id: 'machine-' + module + '-' + machine,
        stationId: floor,
        type: 'refinery',
        x: at,
        y: y + 6,
        rotation: 0,
        recipeId: 'titanium_plates',
      })
      scene.splitters.push({ id: 'splitter-' + module + '-' + machine, type: 'splitter', x: at + 1, y: y + 4, rotation: 0 })
      scene.belts.push({ id: 'branch-' + module + '-' + machine, points: [{ x: at + 1, y: y + 5 }], heading: { x: 0, y: 1 } })
    }
    scene.tunnels.push({ id: 'tunnel-' + module, type: 'underground_mk2', entry: { x: x + 1, y: y + 14 }, exit: { x: x + 10, y: y + 14 } })
  }
  return scene
}
