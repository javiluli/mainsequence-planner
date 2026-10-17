import type { Scene } from '@/features/base-designer/model/scene'

/** Two independent drone cargos reach the BOX through MK1 and MK2 lanes using its real north sockets. */
export function containerScene(): Required<Scene> {
  return {
    stations: [
      { id: 'floor', x: 0, y: 0 },
      { id: 'drone', type: 'drone', x: 0, y: -15, rotation: 0, cargo: ['T_CobaltOre', 'T_TitaniumOre'] },
    ],
    buildings: [{ id: 'box', stationId: 'floor', type: 'container', x: 6, y: 6, rotation: 0 }],
    belts: [
      {
        id: 'cobalt',
        points: [
          { x: 6, y: -1 },
          { x: 6, y: 5 },
        ],
      },
      {
        id: 'titanium',
        type: 'conveyor_mk2',
        points: [
          { x: 7, y: -1 },
          { x: 7, y: 5 },
        ],
      },
    ],
    splitters: [],
    tunnels: [],
  }
}

/** Fresh, valid mixed layout for transformation, tool and persistence contracts; recipes/cargo use real catalog IDs. */
export function mixedScene(): Required<Scene> {
  return {
    stations: [
      { id: 'floor', type: 'station_2x2_a', name: 'Foundry', x: 0, y: 0 },
      { id: 'drone', type: 'drone', x: 40, y: 0, rotation: 90, cargo: ['T_CobaltOre', null], disabledOutputs: ['cargo-0'] },
    ],
    buildings: [
      {
        id: 'machine',
        stationId: 'floor',
        type: 'refinery',
        x: 1,
        y: 1,
        rotation: 90,
        recipeId: 'cobalt_plates',
        disabledOutputs: ['1:1'],
      },
    ],
    belts: [
      {
        id: 'route',
        type: 'conveyor_mk2',
        points: [
          { x: 1, y: 7 },
          { x: 4, y: 7 },
          { x: 4, y: 10 },
        ],
      },
      { id: 'one-cell', points: [{ x: 1, y: 12 }], heading: { x: 1, y: 0 } },
    ],
    splitters: [{ id: 'splitter', type: 'splitter_mk2', x: 6, y: 6, rotation: 90, disabledOutputs: ['north'] }],
    tunnels: [{ id: 'tunnel', type: 'underground_mk2', entry: { x: 8, y: 10 }, exit: { x: 11, y: 10 }, disabledOutputs: ['exit'] }],
  }
}
