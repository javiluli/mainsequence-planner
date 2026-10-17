import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBaseDesignerStore } from '@/store/base-designer.store'
import { SCENE_STORAGE_KEY } from '@/store/base-designer/persistence'
import { writeSceneDocument } from '@/features/base-designer/lib/scene-document'
import { allSelections } from '@/features/base-designer/lib/selection'
import { selectionPivot } from '@/features/base-designer/lib/scene-geometry'
import type { Scene, Selection } from '@/features/base-designer/model/scene'
import { mixedScene } from '../features/base-designer/scene-fixture'

afterEach(() => vi.restoreAllMocks())

/** Hydrate through the real document boundary and observe each atomic write independently of store notifications. */
function groupStore(scene: Scene = mixedScene()) {
  let saved = writeSceneDocument(scene)
  const storage = {
    getItem: () => saved,
    setItem: vi.fn((key: string, value: string) => {
      expect(key).toBe(SCENE_STORAGE_KEY)
      saved = value
    }),
  }
  return { store: createBaseDesignerStore(() => storage), storage, saved: () => saved }
}

describe('Atomic explicit group transactions', () => {
  it('moves a mixed group once with stable identities and complete geometry, leaving unrelated records shared', () => {
    const { store, storage, saved } = groupStore()
    const otherId = store.getState().addStation({ x: 80, y: 0 })!
    const before = store.getState(),
      other = before.stations.at(-1)
    const selection = allSelections(mixedScene()).reverse()
    const ids = vi.spyOn(crypto, 'randomUUID'),
      notified = vi.fn()
    store.subscribe(notified)
    storage.setItem.mockClear()
    expect(store.getState().transformElements(selection, { kind: 'move', offset: { x: -60, y: -30 } }, before)).toBe(true)
    const moved = store.getState()
    expect(moved.past).toHaveLength(before.past.length + 1)
    expect(allSelections(moved).map((item) => item.id)).toEqual(allSelections(before).map((item) => item.id))
    expect(moved.stations.find((item) => item.id === otherId)).toBe(other)
    expect(moved.stations[0]).toMatchObject({ x: -60, y: -30, name: 'Foundry' })
    expect(moved.buildings[0]).toMatchObject({ stationId: 'floor', x: -59, y: -29, recipeId: 'cobalt_plates', disabledOutputs: ['1:1'] })
    expect(moved.belts[0].points).toEqual([
      { x: -59, y: -23 },
      { x: -56, y: -23 },
      { x: -56, y: -20 },
    ])
    expect(moved.belts[1]).toMatchObject({ points: [{ x: -59, y: -18 }], heading: { x: 1, y: 0 } })
    expect(moved.tunnels[0]).toMatchObject({ entry: { x: -52, y: -20 }, exit: { x: -49, y: -20 } })
    expect(saved()).toBe(writeSceneDocument(moved))
    expect(store.getState().undo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(writeSceneDocument(before))
    expect(store.getState().redo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(writeSceneDocument(moved))
    expect(notified).toHaveBeenCalledTimes(3)
    expect(storage.setItem).toHaveBeenCalledTimes(3)
    expect(ids).not.toHaveBeenCalled()
  })

  it('commits four mixed-tier group turns with stable configuration, history and reload', () => {
    const original = mixedScene()
    original.splitters = original.splitters.map((splitter) => ({ ...splitter, type: 'splitter' }))
    const { store, storage, saved } = groupStore(original)
    const selection = allSelections(store.getState()),
      pivot = selectionPivot(store.getState()),
      snapshots = [writeSceneDocument(store.getState())],
      ids = vi.spyOn(crypto, 'randomUUID'),
      notified = vi.fn()
    store.subscribe(notified)
    for (let turn = 1; turn <= 4; turn++) {
      const captured = store.getState()
      expect(store.getState().transformElements(selection, { kind: 'rotate', pivot }, captured)).toBe(true)
      snapshots.push(saved())
      expect(store.getState().past).toHaveLength(turn)
      expect(allSelections(store.getState())).toEqual(selection)
      expect(storage.setItem).toHaveBeenCalledTimes(turn)
      const restored = createBaseDesignerStore(() => storage)
      expect(writeSceneDocument(restored.getState())).toBe(saved())
      expect(restored.getState()).toMatchObject({ past: [], future: [], storageIssue: null })
      expect(storage.setItem).toHaveBeenCalledTimes(turn)
      if (turn === 1) {
        expect(restored.getState().buildings[0]).toMatchObject({
          x: 38,
          y: -11,
          rotation: 180,
          stationId: 'floor',
          recipeId: 'cobalt_plates',
          disabledOutputs: ['1:1'],
        })
        expect(restored.getState().stations[1]).toMatchObject({
          type: 'drone',
          rotation: 180,
          cargo: ['T_CobaltOre', null],
          disabledOutputs: ['cargo-0'],
        })
        expect(restored.getState().belts[1]).toMatchObject({ points: [{ x: 29, y: -11 }], heading: { x: 0, y: 1 } })
        expect(restored.getState().splitters[0].disabledOutputs).toEqual(['north'])
        expect(restored.getState().tunnels[0].disabledOutputs).toEqual(['exit'])
      }
    }
    expect(saved()).toBe(snapshots[0])
    for (let turn = 3; turn >= 0; turn--) {
      expect(store.getState().undo()).toBe(true)
      expect(saved()).toBe(snapshots[turn])
    }
    expect(store.getState().undo()).toBe(false)
    for (const document of snapshots.slice(1)) {
      expect(store.getState().redo()).toBe(true)
      expect(saved()).toBe(document)
    }
    expect(store.getState().redo()).toBe(false)
    expect(notified).toHaveBeenCalledTimes(12)
    expect(storage.setItem).toHaveBeenCalledTimes(12)
    expect(ids).not.toHaveBeenCalled()
  })

  it('allows unrelated edits during a capture and rebinds only the moved building to its new floor', () => {
    const { store } = groupStore()
    const captured = store.getState()
    const destination = store.getState().addStation({ x: 64, y: 0 })!
    const before = store.getState()
    expect(
      store.getState().transformElements([{ kind: 'building', id: 'machine' }], { kind: 'move', offset: { x: 64, y: 0 } }, captured),
    ).toBe(true)
    expect(store.getState().buildings[0]).toMatchObject({
      stationId: destination,
      x: 65,
      y: 1,
      recipeId: 'cobalt_plates',
      disabledOutputs: ['1:1'],
    })
    expect(store.getState().stations).toBe(before.stations)
    expect(store.getState().belts).toBe(before.belts)
    expect(store.getState().tunnels).toBe(before.tunnels)
    expect(store.getState().splitters).toBe(before.splitters)
  })

  it('rejects stale, missing, off-grid, occupied and unchanged proposals without changing redo or storage', () => {
    const { store, storage, saved } = groupStore()
    const captured = store.getState(),
      selection = allSelections(captured)
    expect(store.getState().setPortOutput({ kind: 'building', id: 'machine' }, '1:1', true)).toBe(true)
    store.getState().addStation({ x: 80, y: 0 })
    store.getState().undo()
    const before = store.getState(),
      document = saved()
    const notified = vi.fn(),
      ids = vi.spyOn(crypto, 'randomUUID')
    store.subscribe(notified)
    storage.setItem.mockClear()
    expect(store.getState().transformElements(selection, { kind: 'move', offset: { x: -60, y: 0 } }, captured)).toBe(false)
    expect(store.getState().transformElements([], { kind: 'move', offset: { x: 1, y: 0 } })).toBe(false)
    expect(store.getState().transformElements([{ kind: 'belt', id: 'missing' }], { kind: 'move', offset: { x: 1, y: 0 } })).toBe(false)
    for (const offset of [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: NaN, y: 0 },
    ])
      expect(store.getState().transformElements(selection, { kind: 'move', offset })).toBe(false)
    expect(store.getState().transformElements(selection, { kind: 'rotate', pivot: { x: 0.25, y: 0 } })).toBe(false)
    expect(store.getState().transformElements([{ kind: 'building', id: 'machine' }], { kind: 'move', offset: { x: 40, y: 0 } })).toBe(false)
    expect(store.getState().transformElements([{ kind: 'building', id: 'machine' }], { kind: 'move', offset: { x: 4, y: 4 } })).toBe(false)
    expect(store.getState().pasteGroup(mixedScene(), { x: 0, y: 0 })).toBeNull()
    expect(store.getState().pasteGroup(mixedScene(), { x: 0.5, y: 0 })).toBeNull()
    // A square ordinary floor has no logical orientation; rotating it in place is deliberately a no-op.
    expect(store.getState().transformElements([{ kind: 'station', id: 'floor' }], { kind: 'rotate', pivot: { x: 15, y: 15 } })).toBe(false)
    expect(store.getState()).toBe(before)
    expect(before.future).toHaveLength(1)
    expect(saved()).toBe(document)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(notified).not.toHaveBeenCalled()
    expect(ids).not.toHaveBeenCalled()
  })

  it.each(['machine', 'route', 'splitter', 'tunnel'])(
    'rejects a whole removal when an unselected %s loses floor support',
    (remainingId) => {
      const { store, storage, saved } = groupStore()
      const before = store.getState(),
        document = saved()
      const notified = vi.fn(),
        ids = vi.spyOn(crypto, 'randomUUID')
      store.subscribe(notified)
      expect(store.getState().removeElements(allSelections(before).filter((item) => item.id !== remainingId))).toBe(false)
      expect(store.getState()).toBe(before)
      expect(saved()).toBe(document)
      expect(notified).not.toHaveBeenCalled()
      expect(storage.setItem).not.toHaveBeenCalled()
      expect(ids).not.toHaveBeenCalled()
    },
  )

  it('removes a floor and its explicit contents in one step and restores every collection through history', () => {
    const { store, storage } = groupStore()
    const before = store.getState(),
      drone = before.stations[1],
      notified = vi.fn()
    store.subscribe(notified)
    expect(
      store.getState().removeElements(
        allSelections(before)
          .filter((item) => item.id !== 'drone')
          .reverse(),
      ),
    ).toBe(true)
    const removed = store.getState()
    expect(allSelections(removed)).toEqual([{ kind: 'station', id: 'drone' }])
    expect(removed.stations[0]).toBe(drone)
    expect(removed.past).toHaveLength(1)
    expect(store.getState().undo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(writeSceneDocument(before))
    expect(store.getState().redo()).toBe(true)
    expect(writeSceneDocument(store.getState())).toBe(writeSceneDocument(removed))
    expect(storage.setItem).toHaveBeenCalledTimes(3)
    expect(notified).toHaveBeenCalledTimes(3)
  })

  it.each(['belt', 'tunnel'] as const)('protects corridor support for a complete %s without silently including either floor', (kind) => {
    const scene: Scene = {
      stations: [
        { id: 'left', x: 0, y: 0 },
        { id: 'right', x: 16, y: 0 },
      ],
      buildings: [],
      belts:
        kind === 'belt'
          ? [
              {
                id: 'bridge',
                points: [
                  { x: 14, y: 5 },
                  { x: 15, y: 5 },
                ],
              },
            ]
          : [],
      tunnels: kind === 'tunnel' ? [{ id: 'bridge', type: 'underground', entry: { x: 13, y: 7 }, exit: { x: 16, y: 7 } }] : [],
    }
    const { store, storage } = groupStore(scene)
    expect(store.getState().storageIssue).toBeNull()
    const before = store.getState()
    const left: Selection = { kind: 'station', id: 'left' },
      bridge: Selection = { kind, id: 'bridge' }
    expect(store.getState().removeElements([left])).toBe(false)
    expect(store.getState().transformElements([left, bridge], { kind: 'move', offset: { x: 0, y: 14 } })).toBe(false)
    expect(store.getState()).toBe(before)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(store.getState().transformElements(allSelections(before), { kind: 'move', offset: { x: 0, y: 14 } })).toBe(true)
    expect(store.getState().past).toHaveLength(1)
    expect(store.getState().undo()).toBe(true)
    expect(store.getState().removeElements([left, bridge])).toBe(true)
    expect(store.getState().stations).toEqual([before.stations[1]])
    expect(store.getState().stations[0]).toBe(before.stations[1])
    expect(allSelections(store.getState())).toEqual([{ kind: 'station', id: 'right' }])
  })
})
