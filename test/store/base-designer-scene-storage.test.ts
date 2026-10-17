import { describe, expect, it, vi } from 'vitest'
import type { Scene } from '@/features/base-designer/model/scene'
import { writeSceneDocument } from '@/features/base-designer/lib/scene-document'
import { createBaseDesignerStore } from '@/store/base-designer.store'
import { SCENE_STORAGE_KEY } from '@/store/base-designer/persistence'
import { mixedScene } from '../features/base-designer/scene-fixture'

const scene: Scene = {
  stations: [
    { id: 'floor', x: -14, y: -14 },
    { id: 'empty', x: 0, y: -14 },
  ],
  buildings: [
    { id: 'refinery', stationId: 'floor', type: 'refinery', rotation: 90, x: -13, y: -13 },
    { id: 'assembler', stationId: 'floor', type: 'assembler', rotation: 180, x: -8, y: -13 },
    { id: 'reactor', stationId: 'floor', type: 'reactor', rotation: 270, x: -13, y: -7 },
  ],
  belts: [
    {
      id: 'connected',
      points: [
        { x: -10, y: -12 },
        { x: -9, y: -12 },
      ],
    },
    {
      id: 'loose',
      points: [
        { x: -6, y: -8 },
        { x: -6, y: -4 },
        { x: -2, y: -4 },
      ],
    },
  ],
}

/** In-memory browser boundary exposes exact bytes and calls, without affecting other store instances. */
function storageFixture(saved?: string) {
  const records = new Map<string, string>(saved === undefined ? [] : [[SCENE_STORAGE_KEY, saved]])
  const storage = {
    getItem: vi.fn((key: string) => records.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      records.set(key, value)
    }),
  }
  return { records, storage, store: createBaseDesignerStore(() => storage) }
}

const mixed = mixedScene()
const ordinary: Scene = { stations: [{ id: 'floor', x: 0, y: 0 }], buildings: [], belts: [mixed.belts[1]] }
const logistics: Scene = {
  ...ordinary,
  splitters: [{ ...mixed.splitters[0], type: 'splitter', disabledOutputs: undefined }],
  tunnels: [{ ...mixed.tunnels[0], type: 'underground', disabledOutputs: undefined }],
}
const drones: Scene = {
  ...logistics,
  stations: [...ordinary.stations, { id: 'drone', type: 'drone', x: 40, y: 0, rotation: 90, cargo: ['T_CobaltOre', null] }],
}
const extended: Scene = {
  ...drones,
  stations: [{ ...mixed.stations[0], type: 'station_2x2_b', name: undefined }, drones.stations[1]],
  buildings: [
    { ...mixed.buildings[0], recipeId: undefined, disabledOutputs: undefined },
    { id: 'assembler', stationId: 'floor', type: 'assembler', x: 6, y: 1, rotation: 0 },
    { id: 'reactor', stationId: 'floor', type: 'reactor', x: 13, y: 1, rotation: 180 },
    { id: 'material-lab', stationId: 'floor', type: 'material_lab', x: 1, y: 15, rotation: 90 },
    { id: 'computation-lab', stationId: 'floor', type: 'computation_lab', x: 5, y: 15, rotation: 270 },
    { id: 'enrichment', stationId: 'floor', type: 'enrichment', x: 10, y: 15, rotation: 180 },
    { id: 'container', stationId: 'floor', type: 'container', x: 22, y: 15, rotation: 90 },
  ],
  belts: mixed.belts,
  splitters: [{ ...mixed.splitters[0], disabledOutputs: undefined }],
  tunnels: [{ ...mixed.tunnels[0], exit: { x: 16, y: 10 }, disabledOutputs: undefined }],
}
const recipes: Scene = { ...extended, buildings: [{ ...extended.buildings[0], recipeId: 'cobalt_plates' }, ...extended.buildings.slice(1)] }
const permissions: Scene = {
  ...recipes,
  stations: [recipes.stations[0], mixed.stations[1]],
  buildings: [mixed.buildings[0], ...recipes.buildings.slice(1)],
  splitters: mixed.splitters,
  tunnels: [{ ...extended.tunnels![0], disabledOutputs: ['exit'] }],
}
const named: Scene = { ...permissions, stations: [{ ...permissions.stations[0], name: 'Foundry' }, permissions.stations[1]] }
const modernFormats = [
  [4, ordinary],
  [5, logistics],
  [6, drones],
  [7, extended],
  [8, recipes],
  [9, permissions],
  [10, named],
] as const

describe('Recent saved scene contracts', () => {
  it.each(modernFormats)('restores all format-%i content before saving, then retains it through an accepted edit', (version, scene) => {
    // Assemble the input independently of the writer, including compatibility-only station 2×2 B.
    const saved = JSON.stringify({ version, scene })
    const { storage, records, store } = storageFixture(saved)
    const expected = JSON.parse(JSON.stringify({ ...scene, splitters: scene.splitters ?? [], tunnels: scene.tunnels ?? [] }))
    expect(store.getState()).toMatchObject({ ...expected, storageIssue: null, past: [], future: [] })
    expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(JSON.parse(writeSceneDocument(store.getState())).version).toBe(version)
    expect(store.getState().addStation({ x: 120, y: -40 })).toBeTruthy()
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(records.get(SCENE_STORAGE_KEY)!).version).toBe(version)
    const restored = createBaseDesignerStore(() => storage).getState()
    expect(restored).toMatchObject({
      ...expected,
      stations: [...expected.stations, store.getState().stations.at(-1)],
      past: [],
      future: [],
      storageIssue: null,
    })
    expect(JSON.parse(writeSceneDocument(restored))).toEqual(JSON.parse(records.get(SCENE_STORAGE_KEY)!))
    const document = JSON.parse(records.get(SCENE_STORAGE_KEY)!)
    expect(Object.keys(document.scene).sort()).toEqual(
      version === 4 ? ['belts', 'buildings', 'stations'] : ['belts', 'buildings', 'splitters', 'stations', 'tunnels'],
    )
    expect(Object.keys(document).sort()).toEqual(['scene', 'version'])
    for (const [index, belt] of scene.belts.entries()) {
      expect(document.scene.belts[index]).not.toHaveProperty('capacity')
      if (belt.type === undefined) expect(document.scene.belts[index]).not.toHaveProperty('type')
    }
    for (const splitter of document.scene.splitters ?? []) expect(splitter).not.toHaveProperty('capacity')
    for (const tunnel of document.scene.tunnels ?? []) expect(tunnel).not.toHaveProperty('reach')
  })

  it.each(modernFormats)('protects format-%i content mislabeled as the preceding version', (version, scene) => {
    const saved = JSON.stringify({ version: version - 1, scene })
    const { storage, records, store } = storageFixture(saved)
    expect(store.getState().storageIssue).toBe('unreadable')
    expect(store.getState().addStation({ x: 120, y: -40 })).toBeTruthy()
    store.getState().retrySave()
    expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  const malformed: readonly [string, (scene: Required<Scene>) => unknown][] = [
    [
      'duplicate identity across collections',
      (scene) => ({ ...scene, buildings: [{ ...scene.buildings[0], id: scene.stations[0].id }, ...scene.buildings.slice(1)] }),
    ],
    [
      'unknown recipe',
      (scene) => ({ ...scene, buildings: [{ ...scene.buildings[0], recipeId: 'missing-recipe' }, ...scene.buildings.slice(1)] }),
    ],
    [
      'incompatible recipe',
      (scene) => ({ ...scene, buildings: [{ ...scene.buildings[0], type: 'assembler' }, ...scene.buildings.slice(1)] }),
    ],
    [
      'unknown drone cargo',
      (scene) => ({ ...scene, stations: [scene.stations[0], { ...scene.stations[1], cargo: ['missing-item', null] }] }),
    ],
    ['invalid drone rotation', (scene) => ({ ...scene, stations: [scene.stations[0], { ...scene.stations[1], rotation: 45 }] })],
    ['disabled splitter input', (scene) => ({ ...scene, splitters: [{ ...scene.splitters[0], disabledOutputs: ['west'] }] })],
    ['disabled tunnel input', (scene) => ({ ...scene, tunnels: [{ ...scene.tunnels[0], disabledOutputs: ['entry'] }] })],
    [
      'invalid machine output key',
      (scene) => ({ ...scene, buildings: [{ ...scene.buildings[0], disabledOutputs: ['output'] }, ...scene.buildings.slice(1)] }),
    ],
    ['duplicate output permission', (scene) => ({ ...scene, tunnels: [{ ...scene.tunnels[0], disabledOutputs: ['exit', 'exit'] }] })],
    ['incomplete tunnel', (scene) => ({ ...scene, tunnels: [{ ...scene.tunnels[0], exit: undefined }] })],
    ['tunnel exceeding its tier reach', (scene) => ({ ...scene, tunnels: [{ ...scene.tunnels[0], type: 'underground' }] })],
    [
      'crossing buried routes',
      (scene) => ({
        ...scene,
        tunnels: [...scene.tunnels, { id: 'crossing', type: 'underground', entry: { x: 9, y: 9 }, exit: { x: 9, y: 11 } }],
      }),
    ],
    ['non-cardinal one-cell heading', (scene) => ({ ...scene, belts: [scene.belts[0], { ...scene.belts[1], heading: { x: 1, y: 1 } }] })],
    [
      'building on reserved drone deck',
      (scene) => ({ ...scene, buildings: [{ ...scene.buildings[0], stationId: 'drone', x: 46, y: 2 }, ...scene.buildings.slice(1)] }),
    ],
    ['overlapping drone deck', (scene) => ({ ...scene, stations: [scene.stations[0], { ...scene.stations[1], x: 29 }] })],
    ['blank legacy name', (scene) => ({ ...scene, stations: [{ ...scene.stations[0], name: ' ' }, scene.stations[1]] })],
    ['oversized legacy name', (scene) => ({ ...scene, stations: [{ ...scene.stations[0], name: 'x'.repeat(81) }, scene.stations[1]] })],
  ]

  it.each(malformed)('retains the entire modern document when it contains %s', (_, corrupt) => {
    const scene = corrupt({ ...named, splitters: named.splitters!, tunnels: named.tunnels! })
    const saved = JSON.stringify({ version: 10, scene })
    const { storage, records, store } = storageFixture(saved)
    expect(store.getState()).toMatchObject({
      stations: [],
      buildings: [],
      belts: [],
      splitters: [],
      tunnels: [],
      storageIssue: 'unreadable',
    })
    store.getState().addStation({ x: 120, y: -40 })
    store.getState().retrySave()
    expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})

describe('Single confirmed scene persistence', () => {
  it('saves joined routes, extensions and removals atomically and restores their independent IDs', () => {
    const { storage, records, store } = storageFixture()
    store.getState().addStation({ x: 0, y: 0 })
    const from = [
      { x: 2, y: 7 },
      { x: 5, y: 7 },
    ]
    const mainId = store.getState().addBelt({ points: from })!
    expect(store.getState().extendBelt({ id: mainId, from, points: [...from, { x: 10, y: 7 }] })).toBe(true)
    const branchId = store.getState().addBelt({
      points: [
        { x: 6, y: 2 },
        { x: 6, y: 7 },
      ],
    })!
    const joined = store.getState().belts
    expect(joined.map((belt) => belt.id)).toEqual([mainId, branchId])
    expect(createBaseDesignerStore(() => storage).getState().belts).toEqual(joined)
    store.getState().removeElements([{ kind: 'belt', id: mainId }])
    expect(createBaseDesignerStore(() => storage).getState().belts).toEqual([joined[1]])
    store.getState().undo()
    expect(createBaseDesignerStore(() => storage).getState().belts).toEqual(joined)
    const before = records.get(SCENE_STORAGE_KEY),
      writes = storage.setItem.mock.calls.length
    expect(store.getState().extendBelt({ id: mainId, from, points: [...from, { x: 12, y: 7 }] })).toBe(false)
    expect(records.get(SCENE_STORAGE_KEY)).toBe(before)
    expect(storage.setItem).toHaveBeenCalledTimes(writes)
  })
  it('loads version 2 unchanged and writes version 3 only on the next accepted transaction', () => {
    const saved = JSON.stringify({ version: 2, scene })
    const { storage, records, store } = storageFixture(saved)
    expect(store.getState()).toMatchObject({ ...scene, storageIssue: null })
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
    store.getState().addStation({ x: 14, y: -14 })
    expect(JSON.parse(records.get(SCENE_STORAGE_KEY)!).version).toBe(3)
    expect(createBaseDesignerStore(() => storage).getState().belts).toEqual(scene.belts)
  })
  it('converts version 1 belts without changing identities, anchors or the old bytes before a confirmed edit', () => {
    const legacy = { ...scene, belts: scene.belts.map((belt) => ({ ...belt, stationId: 'floor' })) }
    const saved = JSON.stringify({ version: 1, scene: legacy })
    const { storage, records, store } = storageFixture(saved)
    expect(store.getState()).toMatchObject({ ...scene, storageIssue: null })
    expect(store.getState().belts.every((belt) => !Object.hasOwn(belt, 'stationId'))).toBe(true)
    expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
    expect(storage.setItem).not.toHaveBeenCalled()
    store.getState().addStation({ x: 14, y: -14 })
    const document = JSON.parse(records.get(SCENE_STORAGE_KEY)!)
    expect(document.version).toBe(3)
    expect(document.scene.belts).toEqual(scene.belts)
    expect(createBaseDesignerStore(() => storage).getState().belts).toEqual(scene.belts)
  })

  it('retains invalid version 1 ownership instead of accepting an unsupported cross-floor legacy route', () => {
    const legacy = {
      stations: [
        { id: 'left', x: 0, y: 0 },
        { id: 'right', x: 16, y: 0 },
      ],
      buildings: [],
      belts: [
        {
          id: 'route',
          stationId: 'left',
          points: [
            { x: 11, y: 5 },
            { x: 19, y: 5 },
          ],
        },
      ],
    }
    for (const stationId of ['left', 'missing']) {
      const saved = JSON.stringify({ version: 1, scene: { ...legacy, belts: [{ ...legacy.belts[0], stationId }] } })
      const { records, storage, store } = storageFixture(saved)
      expect(store.getState().storageIssue).toBe('unreadable')
      store.getState().addStation({ x: 32, y: 0 })
      expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
      expect(storage.setItem).not.toHaveBeenCalled()
    }
  })

  it('restores a complete cross-station route and protects both floors through atomic undo/redo and reload', () => {
    const connected = {
      stations: [
        { id: 'left', x: 0, y: 0 },
        { id: 'right', x: 16, y: 0 },
      ],
      buildings: [],
      belts: [
        {
          id: 'route',
          points: [
            { x: 14, y: 5 },
            { x: 15, y: 5 },
          ],
        },
      ],
    }
    const { store, storage } = storageFixture(writeSceneDocument(connected))
    const before = store.getState()
    for (const station of connected.stations) {
      expect(store.getState().removeElements([{ kind: 'station', id: station.id }])).toBe(false)
      expect(store.getState().transformElements([{ kind: 'station', id: station.id }], { kind: 'move', offset: { x: 0, y: 16 } })).toBe(
        false,
      )
    }
    expect(store.getState()).toBe(before)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(store.getState().removeElements([{ kind: 'belt', id: 'route' }])).toBe(true)
    expect(store.getState().transformElements([{ kind: 'station', id: 'right' }], { kind: 'move', offset: { x: 0, y: 16 } })).toBe(true)
    expect(store.getState().undo()).toBe(true)
    expect(store.getState().undo()).toBe(true)
    expect(store.getState().belts).toEqual(connected.belts)
    expect(createBaseDesignerStore(() => storage).getState()).toMatchObject(connected)
    expect(store.getState().redo()).toBe(true)
    expect(store.getState().belts).toEqual([])
    expect(store.getState().past).toHaveLength(1)
  })

  it('saves only accepted transactions and confirmed scene arrays, including deleting the last element', () => {
    const { storage, records, store } = storageFixture()
    expect(storage.setItem).not.toHaveBeenCalled()
    const id = store.getState().addStation({ x: 0, y: 0 })!
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    store.getState().addStation({ x: 1, y: 0 })
    store.getState().transformElements([{ kind: 'station', id }], { kind: 'move', offset: { x: 0, y: 0 } })
    store.getState().removeElements([{ kind: 'station', id: 'missing' }])
    store.getState().retrySave()
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(records.get(SCENE_STORAGE_KEY)!)).toEqual({
      version: 3,
      scene: { stations: [{ id, x: 0, y: 0 }], buildings: [], belts: [] },
    })
    store.getState().removeElements([{ kind: 'station', id }])
    expect(createBaseDesignerStore(() => storage).getState()).toMatchObject({ stations: [], buildings: [], belts: [] })
    expect(storage.setItem).toHaveBeenCalledTimes(2)
  })

  it('leaves original-editor saves byte-for-byte intact through new persistence', () => {
    const legacy = '{"version":1,"state":{"stations":[],"notes":[]}}'
    const { records, storage, store } = storageFixture()
    records.set('mainsequence-base-layout', legacy)
    store.getState().addStation({ x: 0, y: 0 })
    createBaseDesignerStore(() => storage)
    expect(records.get('mainsequence-base-layout')).toBe(legacy)
    expect(storage.getItem.mock.calls.every(([key]) => key === SCENE_STORAGE_KEY)).toBe(true)
    expect(storage.setItem.mock.calls.every(([key]) => key === SCENE_STORAGE_KEY)).toBe(true)
  })

  const invalidScenes = [
    ['missing collections', { stations: [] }],
    ['fractional floor', { ...scene, stations: [{ id: 'floor', x: 0.5, y: 0 }] }],
    ['overlapping floors', { ...scene, stations: [...scene.stations, { id: 'overlap', x: -13, y: -14 }] }],
    ['unsafe floor extent', { ...scene, stations: [{ id: 'floor', x: Number.MAX_SAFE_INTEGER, y: 0 }] }],
    ['duplicate identity', { ...scene, buildings: [{ ...scene.buildings[0], id: 'floor' }] }],
    ['empty identity', { ...scene, buildings: [{ ...scene.buildings[0], id: '' }] }],
    ['unknown type', { ...scene, buildings: [{ ...scene.buildings[0], type: '__proto__' }] }],
    ['missing owner', { ...scene, buildings: [{ ...scene.buildings[0], stationId: 'missing' }] }],
    ['invalid rotation', { ...scene, buildings: [{ ...scene.buildings[0], rotation: 45 }] }],
    ['building outside floor', { ...scene, buildings: [{ ...scene.buildings[0], x: -1 }] }],
    ['overlapping buildings', { ...scene, buildings: [scene.buildings[0], { ...scene.buildings[0], id: 'overlap' }] }],
    ['unfinished belt', { ...scene, belts: [{ ...scene.belts[0], points: [{ x: -10, y: -12 }] }] }],
    [
      'diagonal belt',
      {
        ...scene,
        belts: [
          {
            ...scene.belts[0],
            points: [
              { x: -10, y: -12 },
              { x: -9, y: -11 },
            ],
          },
        ],
      },
    ],
    [
      'belt through buildings',
      {
        ...scene,
        belts: [
          {
            ...scene.belts[0],
            points: [
              { x: -10, y: -12 },
              { x: -3, y: -12 },
            ],
          },
        ],
      },
    ],
    [
      'belt outside floor',
      {
        ...scene,
        belts: [
          {
            ...scene.belts[0],
            points: [
              { x: -6, y: -4 },
              { x: 0, y: -4 },
            ],
          },
        ],
      },
    ],
    ['overlapping belts', { ...scene, belts: [scene.belts[0], { ...scene.belts[0], id: 'overlap' }] }],
  ] as const

  it.each([
    ['invalid JSON', '{unreadable'],
    ['future version', JSON.stringify({ version: 99, scene })],
    // These geometry checks share the same reader; version-specific migrations and joins have separate cases above.
    ...invalidScenes.map(([label, scene]) => [label, JSON.stringify({ version: 3, scene })]),
  ])('protects the entire unreadable scene: %s', (_, saved) => {
    const { storage, records, store } = storageFixture(saved)
    expect(store.getState()).toMatchObject({ stations: [], buildings: [], belts: [], storageIssue: 'unreadable' })
    store.getState().addStation({ x: 0, y: 0 })
    store.getState().retrySave()
    expect(store.getState().storageIssue).toBe('unreadable')
    expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('retains the committed scene and previous save when quota is exceeded, then retries the latest scene', () => {
    const saved = writeSceneDocument(scene)
    const { storage, records, store } = storageFixture(saved)
    const setItem = storage.setItem.getMockImplementation()!
    storage.setItem.mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    const id = store.getState().addStation({ x: 14, y: -14 })!
    store.getState().transformElements([{ kind: 'station', id }], { kind: 'move', offset: { x: 14, y: 0 } })
    expect(store.getState().stations.at(-1)).toEqual({ id, x: 28, y: -14 })
    expect(store.getState().storageIssue).toBe('write-failed')
    expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
    storage.setItem.mockImplementation(setItem)
    store.getState().retrySave()
    expect(store.getState().storageIssue).toBeNull()
    expect(
      createBaseDesignerStore(() => storage)
        .getState()
        .stations.at(-1),
    ).toEqual({ id, x: 28, y: -14 })
  })

  it('automatically recovers a failed write on the next confirmed edit, without saving issue notifications', () => {
    const { storage, store } = storageFixture()
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('Unavailable')
    })
    store.getState().addStation({ x: 0, y: 0 })
    expect(store.getState().storageIssue).toBe('write-failed')
    store.getState().addStation({ x: 14, y: 0 })
    expect(store.getState().storageIssue).toBeNull()
    expect(storage.setItem).toHaveBeenCalledTimes(2)
    expect(createBaseDesignerStore(() => storage).getState().stations).toHaveLength(2)
  })

  it('handles denied storage access and failed reads without ever overwriting unseen data', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('Denied')
      }),
      setItem: vi.fn(),
    }
    for (const getStorage of [
      () => storage,
      () => {
        throw new Error('SecurityError')
      },
    ]) {
      const store = createBaseDesignerStore(getStorage)
      expect(store.getState().storageIssue).toBe('unavailable')
      expect(store.getState().addStation({ x: 0, y: 0 })).toBeTruthy()
      store.getState().retrySave()
      expect(store.getState().storageIssue).toBe('unavailable')
    }
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('blocks stale writes from another open scene, keeping both its session and the newer stored scene', () => {
    const { storage, records, store: first } = storageFixture()
    const second = createBaseDesignerStore(() => storage)
    const id = first.getState().addStation({ x: 0, y: 0 })!
    const saved = records.get(SCENE_STORAGE_KEY)
    second.getState().addStation({ x: 14, y: 0 })
    expect(second.getState().storageIssue).toBe('conflict')
    second.getState().retrySave()
    expect(records.get(SCENE_STORAGE_KEY)).toBe(saved)
    expect(second.getState().stations).toHaveLength(1)
    expect(createBaseDesignerStore(() => storage).getState().stations).toEqual([{ id, x: 0, y: 0 }])
  })
})
