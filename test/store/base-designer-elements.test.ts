import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBaseDesignerStore } from '@/store/base-designer.store'
import { beltConnections } from '@/features/base-designer/lib/belts'
import { writeSceneDocument } from '@/features/base-designer/lib/scene-document'
import type { Scene } from '@/features/base-designer/model/scene'
import { SCENE_STORAGE_KEY } from '@/store/base-designer/persistence'

afterEach(() => vi.restoreAllMocks())

describe('Atomic building and belt edits', () => {
  it.each(['missing-station', '__proto__', 'constructor'])(
    'rejects unknown floor variant %s before IDs, notifications or history',
    (type) => {
      const store = createBaseDesignerStore(),
        before = store.getState()
      const ids = vi.spyOn(crypto, 'randomUUID'),
        notified = vi.fn()
      store.subscribe(notified)
      // @ts-expect-error Intentionally malformed input exercises the runtime boundary.
      expect(store.getState().addStation({ x: 0, y: 0, type })).toBeNull()
      expect(store.getState()).toBe(before)
      expect(ids).not.toHaveBeenCalled()
      expect(notified).not.toHaveBeenCalled()
    },
  )

  it('validates every addition before allocating IDs, copies anchors and rejects incomplete routes', () => {
    const store = createBaseDesignerStore(),
      stationId = store.getState().addStation({ x: 0, y: 0 })!
    const ids = vi.spyOn(crypto, 'randomUUID'),
      notified = vi.fn()
    store.subscribe(notified)
    expect(store.getState().addBuilding({ stationId, x: 13, y: 0, type: 'reactor', rotation: 0 })).toBeNull()
    expect(store.getState().addBelt({ points: [{ x: 2, y: 7 }] })).toBeNull()
    expect(
      store.getState().addBelt({
        points: [
          { x: 2, y: 7 },
          { x: 5, y: 9 },
        ],
      }),
    ).toBeNull()
    expect(ids).not.toHaveBeenCalled()
    expect(notified).not.toHaveBeenCalled()
    const points = [
      { x: 2, y: 7 },
      { x: 5, y: 7 },
    ]
    expect(store.getState().addBelt({ points })).toBeTruthy()
    points[0].x = 100
    expect(store.getState().belts[0].points[0].x).toBe(2)
    expect(ids).toHaveBeenCalledTimes(1)
    expect(notified).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported station edits, keeps belts fixed through building edits and restores connection on return', () => {
    const store = createBaseDesignerStore(),
      stationId = store.getState().addStation({ x: 0, y: 0 })!
    const id = store.getState().addBuilding({ stationId, x: 1, y: 2, type: 'refinery', rotation: 0 })!
    store.getState().addBuilding({ stationId, x: 8, y: 2, type: 'refinery', rotation: 0 })
    store.getState().addBelt({
      points: [
        { x: 4, y: 3 },
        { x: 7, y: 3 },
      ],
    })
    const belts = store.getState().belts,
      before = store.getState()
    expect(store.getState().transformElements([{ kind: 'station', id: stationId }], { kind: 'move', offset: { x: 0, y: 14 } })).toBe(false)
    expect(store.getState().removeElements([{ kind: 'station', id: stationId }])).toBe(false)
    expect(store.getState().transformElements([{ kind: 'building', id }], { kind: 'move', offset: { x: 4, y: 0 } })).toBe(false)
    expect(store.getState()).toBe(before)
    expect(store.getState().transformElements([{ kind: 'building', id }], { kind: 'move', offset: { x: 0, y: 6 } }, before)).toBe(true)
    expect(store.getState().belts).toBe(belts)
    expect(beltConnections(store.getState(), belts[0]).output).toBeUndefined()
    expect(store.getState().transformElements([{ kind: 'building', id }], { kind: 'move', offset: { x: 0, y: -6 } }, before)).toBe(false)
    expect(store.getState().transformElements([{ kind: 'building', id }], { kind: 'move', offset: { x: 0, y: -6 } })).toBe(true)
    expect(beltConnections(store.getState(), belts[0]).output).toBeDefined()
    expect(store.getState().removeElements([{ kind: 'building', id }])).toBe(true)
    expect(store.getState().belts).toBe(belts)
    expect(store.getState().removeElements([{ kind: 'belt', id: belts[0].id }])).toBe(true)
    expect(store.getState().belts).toHaveLength(0)
  })
})

describe('Atomic route extension', () => {
  it('rejects stale, unchanged, rewritten or occupied proposals without IDs or history, then extends once', () => {
    const store = createBaseDesignerStore()
    store.getState().addStation({ x: 0, y: 0 })
    const from = [
      { x: 2, y: 10 },
      { x: 5, y: 10 },
    ]
    const id = store.getState().addBelt({ points: from })!
    const before = store.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    for (const proposal of [
      { id, from, points: from },
      { id, from: [{ x: 1, y: 10 }, from[1]], points: [...from, { x: 8, y: 10 }] },
      { id, from, points: [{ x: 1, y: 10 }, from[1], { x: 8, y: 10 }] },
      { id, from, points: [...from, { x: 8, y: 11 }] },
      { id: 'missing', from, points: [...from, { x: 8, y: 10 }] },
    ])
      expect(store.getState().extendBelt(proposal)).toBe(false)
    expect(store.getState()).toBe(before)
    const points = [...from, { x: 8, y: 10 }]
    expect(store.getState().extendBelt({ id, from, points })).toBe(true)
    points[2].x = 100
    expect(store.getState().belts[0]).toEqual({ id, points: [...from, { x: 8, y: 10 }] })
    expect(store.getState().past).toHaveLength(before.past.length + 1)
    const extended = store.getState()
    expect(store.getState().extendBelt({ id, from, points: [...from, { x: 10, y: 10 }] })).toBe(false)
    expect(store.getState()).toBe(extended)
    expect(ids).not.toHaveBeenCalled()
  })
})

describe('Confirmed output configuration', () => {
  it.each(['building', 'splitter', 'underground_mk2'] as const)('owns the permissions passed to an individual addition (%s)', (kind) => {
    const store = createBaseDesignerStore()
    const stationId = store.getState().addStation({ x: 0, y: 0 })!
    const permission = kind === 'building' ? '1:1' : kind === 'splitter' ? 'north' : 'exit'
    const disabledOutputs = [permission]
    const id =
      kind === 'building'
        ? store
            .getState()
            .addBuilding({ stationId, type: 'refinery', rotation: 90, x: 1, y: 1, recipeId: 'cobalt_plates', disabledOutputs })
        : kind === 'splitter'
          ? store.getState().addSplitter({ type: kind, rotation: 90, x: 1, y: 1, disabledOutputs })
          : store.getState().addTunnel({ type: kind, entry: { x: 1, y: 1 }, exit: { x: 4, y: 1 }, disabledOutputs })
    expect(id).toBeTruthy()
    const confirmed = store.getState()
    const piece = [...confirmed.buildings, ...confirmed.splitters, ...confirmed.tunnels].find((item) => item.id === id)!
    expect(piece.disabledOutputs).toEqual([permission])
    expect(piece.disabledOutputs).not.toBe(disabledOutputs)
    const document = writeSceneDocument(confirmed)
    const notified = vi.fn()
    const stop = store.subscribe(notified)
    disabledOutputs.length = 0
    expect(store.getState()).toBe(confirmed)
    expect(writeSceneDocument(store.getState())).toBe(document)
    expect(notified).not.toHaveBeenCalled()
    stop()
    expect(store.getState().addStation({ x: 30, y: 0 })).toBeTruthy()
    expect(writeSceneDocument(store.getState().past.at(-1)!)).toBe(document)
    expect(store.getState().undo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(document)
    expect(store.getState().undo()).toBe(true)
    expect([...store.getState().buildings, ...store.getState().splitters, ...store.getState().tunnels]).toHaveLength(0)
    expect(store.getState().redo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(document)
  })

  it('isolates permissions and cargo in a mixed-tier group across history and reload', () => {
    const buildingOutputs = ['1:1'],
      splitterOutputs = ['north'],
      tunnelOutputs = ['exit'],
      droneOutputs = ['cargo-0'],
      cargo: [string | null, string | null] = ['T_CobaltOre', null]
    const group: Scene = {
      stations: [
        { id: 'floor', type: 'station_2x2_a', x: 0, y: 0 },
        { id: 'drone', type: 'drone', x: 40, y: 0, rotation: 90, cargo, disabledOutputs: droneOutputs },
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
          disabledOutputs: buildingOutputs,
        },
      ],
      belts: [
        {
          id: 'belt',
          type: 'conveyor_mk2',
          points: [
            { x: 1, y: 7 },
            { x: 4, y: 7 },
          ],
        },
      ],
      splitters: [{ id: 'splitter', type: 'splitter', x: 6, y: 6, rotation: 90, disabledOutputs: splitterOutputs }],
      tunnels: [
        {
          id: 'tunnel',
          type: 'underground_mk2',
          entry: { x: 8, y: 10 },
          exit: { x: 11, y: 10 },
          disabledOutputs: tunnelOutputs,
        },
      ],
    }
    const records = new Map<string, string>()
    const storage = {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => records.set(key, value)),
    }
    const store = createBaseDesignerStore(() => storage)
    const selected = store.getState().pasteGroup(group, { x: -60, y: -30 })!
    expect(selected).toHaveLength(6)
    expect(new Set(selected.map((item) => item.id)).size).toBe(6)
    const confirmed = store.getState()
    expect(confirmed.past).toHaveLength(1)
    expect(confirmed.buildings[0]).toMatchObject({ recipeId: 'cobalt_plates', rotation: 90, disabledOutputs: ['1:1'] })
    expect(confirmed.splitters[0].disabledOutputs).toEqual(['north'])
    expect(confirmed.tunnels[0].disabledOutputs).toEqual(['exit'])
    expect(confirmed.stations[1]).toMatchObject({ type: 'drone', cargo: ['T_CobaltOre', null], disabledOutputs: ['cargo-0'] })
    const document = writeSceneDocument(confirmed)
    expect(records.get(SCENE_STORAGE_KEY)).toBe(document)
    const notified = vi.fn()
    const stop = store.subscribe(notified)
    // Caller-owned arrays may change later; confirmed content and its snapshots must remain untouched.
    for (const outputs of [buildingOutputs, splitterOutputs, tunnelOutputs, droneOutputs]) outputs.length = 0
    cargo[0] = null
    expect(store.getState()).toBe(confirmed)
    expect(writeSceneDocument(store.getState())).toBe(document)
    expect(records.get(SCENE_STORAGE_KEY)).toBe(document)
    expect(notified).not.toHaveBeenCalled()
    stop()
    expect(store.getState().addStation({ x: -100, y: 0 })).toBeTruthy()
    const nextDocument = writeSceneDocument(store.getState())
    expect(writeSceneDocument(store.getState().past.at(-1)!)).toBe(document)
    expect(store.getState().undo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(document)
    expect(store.getState().undo()).toBe(true)
    expect(store.getState().stations).toHaveLength(0)
    expect(store.getState().redo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(document)
    expect(store.getState().redo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(nextDocument)
    expect(storage.setItem).toHaveBeenCalledTimes(6)
    const restored = createBaseDesignerStore(() => storage).getState()
    expect(JSON.parse(writeSceneDocument(restored))).toEqual(JSON.parse(nextDocument))
    expect(restored.past).toEqual([])
    expect(restored.future).toEqual([])
  })

  it('retains an explicit empty permission list without borrowing it', () => {
    const store = createBaseDesignerStore()
    store.getState().addStation({ x: 0, y: 0 })
    const disabledOutputs: string[] = []
    expect(
      store.getState().addTunnel({
        type: 'underground',
        entry: { x: 1, y: 1 },
        exit: { x: 4, y: 1 },
        disabledOutputs,
      }),
    ).toBeTruthy()
    const confirmed = store.getState()
    expect(confirmed.tunnels[0].disabledOutputs).toEqual([])
    expect(confirmed.tunnels[0].disabledOutputs).not.toBe(disabledOutputs)
    const document = writeSceneDocument(confirmed)
    disabledOutputs.push('exit')
    expect(store.getState()).toBe(confirmed)
    expect(writeSceneDocument(store.getState())).toBe(document)
  })

  it('rejects invalid permissions before allocating IDs or changing the redo branch', () => {
    const store = createBaseDesignerStore()
    const stationId = store.getState().addStation({ x: 0, y: 0 })!
    const tunnel = { type: 'underground' as const, entry: { x: 1, y: 1 }, exit: { x: 4, y: 1 } }
    expect(store.getState().addTunnel(tunnel)).toBeTruthy()
    expect(store.getState().undo()).toBe(true)
    const before = store.getState()
    const ids = vi.spyOn(crypto, 'randomUUID')
    const notified = vi.fn()
    const stop = store.subscribe(notified)
    for (const disabledOutputs of [['unknown'], ['exit', 'exit']]) {
      expect(store.getState().addTunnel({ ...tunnel, disabledOutputs })).toBeNull()
      expect(
        store.getState().pasteGroup(
          {
            stations: [],
            buildings: [{ id: 'machine', stationId, type: 'refinery', rotation: 0, x: 1, y: 5, disabledOutputs }],
            belts: [],
            tunnels: [{ ...tunnel, id: 'tunnel', disabledOutputs: ['exit'] }],
          },
          { x: 1, y: 1 },
        ),
      ).toBeNull()
    }
    expect(store.getState()).toBe(before)
    expect(store.getState().future).toHaveLength(1)
    expect(ids).not.toHaveBeenCalled()
    expect(notified).not.toHaveBeenCalled()
    stop()
  })
})
