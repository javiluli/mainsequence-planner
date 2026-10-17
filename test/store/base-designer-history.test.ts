import { describe, expect, it, vi } from 'vitest'
import { createBaseDesignerStore } from '@/store/base-designer.store'
import { SCENE_STORAGE_KEY } from '@/store/base-designer/persistence'
import { beltConnections } from '@/features/base-designer/lib/belts'
import { writeSceneDocument } from '@/features/base-designer/lib/scene-document'
import type { Scene } from '@/features/base-designer/model/scene'

/** Compare the confirmed document independently of session history and store actions. */
function sceneOf({ stations, buildings, belts, splitters, tunnels }: Scene): Scene {
  return { stations, buildings, belts, splitters, tunnels }
}

describe('Confirmed scene undo and redo', () => {
  it('replays complete transactions with stable IDs, route geometry and coordinate ownership', () => {
    const store = createBaseDesignerStore()
    const snapshots = [sceneOf(store.getState())]
    const edit = (operation: () => unknown) => {
      const notified = vi.fn()
      const stop = store.subscribe(notified)
      expect(operation()).toBeTruthy()
      stop()
      expect(notified).toHaveBeenCalledTimes(1)
      snapshots.push(sceneOf(store.getState()))
    }
    let floor = '',
      empty = '',
      building = '',
      belt = ''
    edit(() => (floor = store.getState().addStation({ x: 0, y: 0 })!))
    edit(() => (empty = store.getState().addStation({ x: 14, y: 0 })!))
    edit(() => (building = store.getState().addBuilding({ stationId: floor, type: 'refinery', rotation: 0, x: 1, y: 1 })!))
    edit(() => store.getState().addBuilding({ stationId: floor, type: 'refinery', rotation: 0, x: 8, y: 1 }))
    edit(
      () =>
        (belt = store.getState().addBelt({
          points: [
            { x: 4, y: 2 },
            { x: 7, y: 2 },
          ],
        })!),
    )
    expect(beltConnections(store.getState(), store.getState().belts[0]).output).toBeDefined()
    edit(() => store.getState().transformElements([{ kind: 'building', id: building }], { kind: 'rotate', pivot: { x: 2.5, y: 2.5 } }))
    edit(() => store.getState().transformElements([{ kind: 'building', id: building }], { kind: 'move', offset: { x: 14, y: 0 } }))
    expect(store.getState().buildings[0].stationId).toBe(empty)
    expect(beltConnections(store.getState(), store.getState().belts[0]).output).toBeUndefined()
    edit(() => store.getState().removeElements([{ kind: 'belt', id: belt }]))
    edit(() => store.getState().removeElements([{ kind: 'building', id: building }]))
    edit(() => store.getState().transformElements([{ kind: 'station', id: empty }], { kind: 'move', offset: { x: -28, y: -14 } }))
    edit(() => store.getState().removeElements([{ kind: 'station', id: empty }]))
    const ids = vi.spyOn(crypto, 'randomUUID')
    const notified = vi.fn()
    store.subscribe(notified)
    for (let i = snapshots.length - 2; i >= 0; i--) {
      expect(store.getState().undo()).toBe(true)
      expect(sceneOf(store.getState())).toEqual(snapshots[i])
    }
    expect(store.getState().undo()).toBe(false)
    for (const snapshot of snapshots.slice(1)) {
      expect(store.getState().redo()).toBe(true)
      expect(sceneOf(store.getState())).toEqual(snapshot)
    }
    expect(store.getState().redo()).toBe(false)
    expect(notified).toHaveBeenCalledTimes((snapshots.length - 1) * 2)
    expect(ids).not.toHaveBeenCalled()
    ids.mockRestore()
  })

  it('keeps redo after invalid, stale or unchanged proposals and drops it only after a new accepted edit', () => {
    const store = createBaseDesignerStore()
    const floor = store.getState().addStation({ x: 0, y: 0 })!
    const building = store.getState().addBuilding({ stationId: floor, type: 'assembler', rotation: 0, x: 1, y: 1 })!
    store.getState().transformElements([{ kind: 'building', id: building }], { kind: 'rotate', pivot: { x: 3.5, y: 3.5 } })
    const rotated = store.getState()
    store.getState().undo()
    const before = store.getState()
    expect(store.getState().addStation({ x: 1, y: 0 })).toBeNull()
    expect(store.getState().transformElements([{ kind: 'station', id: floor }], { kind: 'move', offset: { x: 14, y: 0 } })).toBe(false)
    expect(store.getState().removeElements([{ kind: 'station', id: floor }])).toBe(false)
    expect(store.getState().transformElements([{ kind: 'building', id: building }], { kind: 'move', offset: { x: 0, y: 0 } })).toBe(false)
    expect(store.getState().transformElements([{ kind: 'building', id: building }], { kind: 'rotate', pivot: { x: 0.25, y: 0 } })).toBe(
      false,
    )
    expect(
      store.getState().transformElements([{ kind: 'building', id: building }], { kind: 'move', offset: { x: 6, y: 0 } }, rotated),
    ).toBe(false)
    expect(
      store.getState().addBelt({
        points: [
          { x: 2, y: 2 },
          { x: 3, y: 2 },
        ],
      }),
    ).toBeNull()
    expect(store.getState().removeElements([{ kind: 'belt', id: 'missing' }])).toBe(false)
    expect(store.getState()).toBe(before)
    expect(store.getState().future).toHaveLength(1)
    store.getState().addStation({ x: 14, y: 0 })
    expect(store.getState().future).toHaveLength(0)
    expect(store.getState().redo()).toBe(false)
    store.getState().undo()
    expect(store.getState().buildings[0].rotation).toBe(0)
  })

  it('shares immutable collections and bounds the combined history to the last 100 operations', () => {
    const store = createBaseDesignerStore()
    const floor = store.getState().addStation({ x: 0, y: 0 })!
    const stations = store.getState().stations
    const building = store.getState().addBuilding({ stationId: floor, type: 'reactor', rotation: 0, x: 1, y: 1 })!
    const firstBuilding = store.getState().buildings[0]
    const history = store.getState().past
    expect(history[1].stations).toBe(stations)
    store.getState().transformElements([{ kind: 'building', id: building }], { kind: 'rotate', pivot: { x: 4, y: 4 } })
    expect(firstBuilding.rotation).toBe(0)
    expect(history).toHaveLength(2)
    for (let i = 0; i < 110; i++)
      expect(store.getState().transformElements([{ kind: 'building', id: building }], { kind: 'rotate', pivot: { x: 4, y: 4 } })).toBe(true)
    expect(store.getState().past).toHaveLength(100)
    expect(store.getState().past.every((snapshot) => snapshot.stations === stations)).toBe(true)
    for (let i = 0; i < 100; i++) expect(store.getState().undo()).toBe(true)
    expect(store.getState().undo()).toBe(false)
    expect(store.getState().stations).toBe(stations)
    expect(store.getState().future).toHaveLength(100)
    for (let i = 0; i < 100; i++) expect(store.getState().redo()).toBe(true)
    expect(store.getState().past).toHaveLength(100)
    expect(store.getState().future).toHaveLength(0)
  })

  it('saves undo/redo scenes once per operation and restores them with an empty session history', () => {
    const records = new Map<string, string>()
    const storage = {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => {
        records.set(key, value)
      }),
    }
    const store = createBaseDesignerStore(() => storage)
    const floor = store.getState().addStation({ x: -14, y: -14 })!
    const original = sceneOf(store.getState())
    store.getState().transformElements([{ kind: 'station', id: floor }], { kind: 'move', offset: { x: 14, y: 0 } })
    const moved = sceneOf(store.getState())
    store.getState().undo()
    expect(records.get(SCENE_STORAGE_KEY)).toBe(writeSceneDocument(original))
    store.getState().redo()
    expect(records.get(SCENE_STORAGE_KEY)).toBe(writeSceneDocument(moved))
    expect(storage.setItem).toHaveBeenCalledTimes(4)
    expect(JSON.parse(records.get(SCENE_STORAGE_KEY)!)).toEqual({
      version: 3,
      scene: { stations: moved.stations, buildings: moved.buildings, belts: moved.belts },
    })
    const restored = createBaseDesignerStore(() => storage)
    expect(sceneOf(restored.getState())).toEqual(moved)
    expect(restored.getState()).toMatchObject({ past: [], future: [] })
    expect(restored.getState().undo()).toBe(false)
    expect(restored.getState().redo()).toBe(false)
    expect(storage.setItem).toHaveBeenCalledTimes(4)
  })

  it('keeps history usable after a storage failure and does not turn retry status into an undo entry', () => {
    const records = new Map<string, string>()
    const storage = {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => {
        records.set(key, value)
      }),
    }
    const store = createBaseDesignerStore(() => storage)
    store.getState().addStation({ x: 0, y: 0 })
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('Quota exceeded')
    })
    store.getState().undo()
    expect(store.getState()).toMatchObject({ stations: [], past: [], future: expect.any(Array), storageIssue: 'write-failed' })
    const future = store.getState().future
    store.getState().retrySave()
    expect(store.getState().future).toBe(future)
    expect(store.getState().past).toHaveLength(0)
    expect(store.getState().storageIssue).toBeNull()
    expect(store.getState().redo()).toBe(true)
    expect(createBaseDesignerStore(() => storage).getState().stations).toHaveLength(1)
  })
})
