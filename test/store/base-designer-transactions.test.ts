import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBaseDesignerStore } from '@/store/base-designer.store'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Confirmed station transactions', () => {
  it('validates additions before allocating IDs or notifying subscribers', () => {
    const ids = vi.spyOn(crypto, 'randomUUID')
    const store = createBaseDesignerStore()
    const notified = vi.fn()
    store.subscribe(notified)
    const id = store.getState().addStation({ x: 0, y: 0 })
    expect(id).toBeTruthy()
    const before = store.getState()
    expect(store.getState().addStation({ x: 13, y: 0 })).toBeNull()
    expect(store.getState().addStation({ x: NaN, y: 0 })).toBeNull()
    expect(store.getState()).toBe(before)
    expect(ids).toHaveBeenCalledTimes(1)
    expect(notified).toHaveBeenCalledTimes(1)
  })

  it('rejects overlaps, no-ops and stale captures without changing the confirmed scene', () => {
    const store = createBaseDesignerStore()
    const id = store.getState().addStation({ x: 0, y: 0 })!
    store.getState().addStation({ x: 14, y: 0 })
    const before = store.getState()
    const notified = vi.fn()
    store.subscribe(notified)
    for (const proposal of [
      { id, offset: { x: 1, y: 0 }, from: before },
      { id, offset: { x: 0, y: 0 }, from: before },
      { id, offset: { x: -14, y: 0 }, from: { ...before, stations: [{ ...before.stations[0], x: -1 }, before.stations[1]] } },
      { id: 'missing', offset: { x: -14, y: 0 }, from: before },
    ]) {
      expect(
        store
          .getState()
          .transformElements([{ kind: 'station', id: proposal.id }], { kind: 'move', offset: proposal.offset }, proposal.from),
      ).toBe(false)
      expect(store.getState()).toBe(before)
    }
    expect(notified).not.toHaveBeenCalled()
  })

  it('commits one grid-aligned move, preserves other station identities and rejects the original capture afterward', () => {
    const store = createBaseDesignerStore()
    const id = store.getState().addStation({ x: 0, y: 0 })!
    store.getState().addStation({ x: 14, y: 0 })
    const other = store.getState().stations[1]
    const captured = store.getState(),
      offset = { x: -14, y: -4 }
    const notified = vi.fn()
    store.subscribe(notified)
    expect(store.getState().transformElements([{ kind: 'station', id }], { kind: 'move', offset }, captured)).toBe(true)
    offset.x = 100
    expect(store.getState().stations[0]).toEqual({ id, x: -14, y: -4 })
    expect(store.getState().stations[1]).toBe(other)
    expect(notified).toHaveBeenCalledTimes(1)
    expect(store.getState().transformElements([{ kind: 'station', id }], { kind: 'move', offset: { x: -28, y: 0 } }, captured)).toBe(false)
  })

  it('removes only the explicit station and leaves unknown-ID removals unchanged', () => {
    const store = createBaseDesignerStore()
    const id = store.getState().addStation({ x: 0, y: 0 })!
    const other = store.getState().addStation({ x: 14, y: 0 })!
    expect(store.getState().removeElements([{ kind: 'station', id }])).toBe(true)
    expect(store.getState().stations.map((station) => station.id)).toEqual([other])
    const before = store.getState()
    expect(store.getState().removeElements([{ kind: 'station', id }])).toBe(false)
    expect(store.getState()).toBe(before)
  })

  it('never reads or overwrites the original saved document without an explicit storage provider', () => {
    const saved =
      '{"version":1,"state":{"stations":[{"id":"old","type":"station_1x1","position":{"x":0,"y":0},"placements":[]}],"notes":[]}}'
    const records = new Map([['mainsequence-base-layout', saved]])
    const storage = {
      getItem: vi.fn((key: string) => records.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => records.set(key, value)),
      removeItem: vi.fn((key: string) => records.delete(key)),
    }
    vi.stubGlobal('localStorage', storage)
    const store = createBaseDesignerStore()
    const id = store.getState().addStation({ x: 0, y: 0 })!
    expect(store.getState().transformElements([{ kind: 'station', id }], { kind: 'move', offset: { x: -14, y: 0 } })).toBe(true)
    const buildingId = store.getState().addBuilding({ stationId: id, type: 'refinery', rotation: 0, x: -14, y: 0 })!
    const beltId = store.getState().addBelt({
      points: [
        { x: -12, y: 7 },
        { x: -8, y: 7 },
      ],
    })!
    expect(
      store.getState().transformElements([{ kind: 'building', id: buildingId }], { kind: 'rotate', pivot: { x: -12.5, y: 1.5 } }),
    ).toBe(true)
    expect(store.getState().removeElements([{ kind: 'building', id: buildingId }])).toBe(true)
    expect(store.getState().removeElements([{ kind: 'belt', id: beltId }])).toBe(true)
    expect(store.getState().removeElements([{ kind: 'station', id }])).toBe(true)
    expect(createBaseDesignerStore().getState().stations).toEqual([])
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.removeItem).not.toHaveBeenCalled()
    expect(records.get('mainsequence-base-layout')).toBe(saved)
  })
})
