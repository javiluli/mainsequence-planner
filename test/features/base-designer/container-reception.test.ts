import { expect, it } from 'vitest'
import type { Scene } from '@/features/base-designer/model/scene'
import { beltNetwork } from '@/features/base-designer/lib/belt-network'
import { analyzeProduction } from '@/features/base-designer/lib/production-analysis'
import { canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import { rotateGroup } from '@/features/base-designer/lib/scene-geometry'
import { readSceneDocument } from '@/features/base-designer/lib/scene-document'
import { containerScene } from './scene-fixture'

/** Validate actual footprints and sockets before testing the shared transport allocation. */
function inspect(scene: Scene) {
  expect(canPlaceScenePieces(scene)).toBe(true)
  return analyzeProduction(scene, beltNetwork(scene))
}

it('lists every incoming item at its lane rate in all four orientations without adding recipe totals', () => {
  let scene = containerScene()
  expect(readSceneDocument({ version: 10, scene })).toEqual(scene)
  for (let turn = 0; turn < 4; turn++) {
    const original = structuredClone(scene),
      analysis = inspect(scene)
    expect(analysis.machines.get('box')).toMatchObject({
      state: 'ready',
      inputs: [],
      unexpectedItems: [],
      reception: {
        items: [
          { itemId: 'T_CobaltOre', available: 60 },
          { itemId: 'T_TitaniumOre', available: 120 },
        ],
        unknown: false,
      },
    })
    expect(analysis.products).toEqual([])
    expect(analysis.recipes).toEqual([])
    expect(analysis.energy).toEqual({ known: 0, unknown: 1 })
    expect(inspect(scene)).toEqual(analysis)
    expect(scene).toEqual(original)
    scene = rotateGroup(scene)
  }
})

it('sums the same item across incoming faces without imposing a storage capacity', () => {
  const original = containerScene(),
    scene: Scene = {
      ...original,
      stations: original.stations.map((station) =>
        station.type === 'drone' ? { ...station, cargo: ['T_CobaltOre', 'T_CobaltOre'] as const } : station,
      ),
    }
  expect(inspect(scene).machines.get('box')?.reception?.items).toEqual([{ itemId: 'T_CobaltOre', demand: null, available: 180 }])
})

it.each(['disconnected', 'disabled'] as const)('marks a BOX without incoming items as missing (%s)', (kind) => {
  const original = containerScene(),
    scene: Scene = {
      ...original,
      ...(kind === 'disconnected'
        ? { belts: [] }
        : {
            stations: original.stations.map((station) =>
              station.type === 'drone' ? { ...station, disabledOutputs: ['cargo-0', 'cargo-1'] } : station,
            ),
          }),
    }
  expect(inspect(scene).machines.get('box')).toMatchObject({
    state: 'missing-input',
    reception: { items: [], unknown: false },
  })
})

it('keeps unidentified supply explicit alongside known incoming item IDs', () => {
  const original = containerScene(),
    scene: Scene = {
      ...original,
      buildings: [...original.buildings, { id: 'unknown', stationId: 'floor', type: 'refinery', x: 8, y: 1, rotation: 0 }],
      belts: [
        original.belts[0],
        {
          id: 'unknown-feed',
          points: [
            { x: 7, y: 2 },
            { x: 7, y: 5 },
          ],
        },
      ],
    }
  expect(inspect(scene).machines.get('box')).toMatchObject({
    state: 'unknown',
    reception: { items: [{ itemId: 'T_CobaltOre', available: null }], unknown: true },
  })
})

it('retains every known item in a mixed lane without inventing its individual rate', () => {
  const original = containerScene(),
    scene: Scene = {
      ...original,
      belts: [
        original.belts[0],
        {
          id: 'mixed',
          points: [
            { x: 7, y: -1 },
            { x: 7, y: 1 },
            { x: 6, y: 1 },
          ],
        },
      ],
    }
  expect(inspect(scene).machines.get('box')).toMatchObject({
    state: 'unknown',
    reception: {
      items: [
        { itemId: 'T_CobaltOre', available: null },
        { itemId: 'T_TitaniumOre', available: null },
      ],
      unknown: false,
    },
  })
})

it.each([true, false])('pools a finite recipe across two outlets and preserves upstream uncertainty (supplied=%s)', (supplied) => {
  const scene: Scene = {
    stations: containerScene().stations,
    buildings: [
      { id: 'producer', stationId: 'floor', type: 'refinery', x: 1, y: 1, rotation: 0, recipeId: 'cobalt_plates' },
      ...containerScene().buildings,
    ],
    belts: [
      ...(supplied
        ? [
            {
              id: 'raw',
              points: [
                { x: 6, y: -1 },
                { x: 6, y: 0 },
                { x: 2, y: 0 },
              ],
            },
          ]
        : []),
      {
        id: 'east',
        points: [
          { x: 4, y: 2 },
          { x: 6, y: 2 },
          { x: 6, y: 5 },
        ],
      },
      {
        id: 'south',
        points: [
          { x: 2, y: 4 },
          { x: 2, y: 5 },
          { x: 5, y: 5 },
          { x: 5, y: 6 },
        ],
      },
    ],
  }
  expect(inspect(scene).machines.get('box')).toMatchObject({
    state: supplied ? 'ready' : 'unknown',
    reception: { items: [{ itemId: 'T_CobaltPlates', available: supplied ? 20 : null }], unknown: false },
  })
})
