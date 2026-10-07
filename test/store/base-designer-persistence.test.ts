import { describe, expect, it, vi } from 'vitest'
import { createBaseDesignerStore } from '@/store/base-designer.store'
import { BASE_STORAGE_KEY, BASE_STORAGE_VERSION } from '@/store/base-designer/persistence'
import { decodeBaseLayout } from '@/features/base-designer/lib/layout/layout-document'
import { CELL_SIZE } from '@/features/base-designer/model/catalog'
import { routeCells } from '@/features/base-designer/lib/routes/route'
import { machinePorts } from '@/features/base-designer/lib/connections/ports'

function memoryStorage() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
    removeItem: (key: string) => {
      entries.delete(key)
    },
  }
}

function populated(storage: ReturnType<typeof memoryStorage>) {
  const store = createBaseDesignerStore(() => storage)
  const first = store.getState().addStation('station_1x1', { x: 0, y: 0 })!
  const second = store.getState().addStation('station_1x1', { x: 16 * CELL_SIZE, y: 0 })!
  store.getState().toggleStationLock(first, second)
  expect(store.getState().place(first, 'refinery', 1, 1)).toBe(true)
  const piece = store.getState().stations[0].placements[0]
  expect(store.getState().setMachineProduct(first, piece.id, 'T_CobaltPlates')).toBe(true)
  const port = machinePorts(piece)[0]
  store.getState().toggleMachineOutput(first, piece.id, port.face, port.offset)
  expect(
    store.getState().placeRoute(
      first,
      'conveyor',
      routeCells([
        { kind: 'floor', x: 10, y: 6 },
        { kind: 'floor', x: 19, y: 6 },
      ]),
    ),
  ).toBe(true)
  expect(
    store.getState().placeRoute(
      first,
      'underground',
      routeCells([
        { kind: 'floor', x: 2, y: 10 },
        { kind: 'floor', x: 7, y: 10 },
      ]),
    ),
  ).toBe(true)
  const drone = store.getState().addStation('drone_station', { x: 40 * CELL_SIZE, y: 0 })!
  store.getState().setDroneOutput(drone, 1, 'T_CobaltPlates')
  const note = store.getState().addNote({ x: -10.5, y: 65.5 })
  store.getState().updateNote(note, 'Reserve room for expansion')
  return store
}

function savedDocument(storage: ReturnType<typeof memoryStorage>) {
  return JSON.parse(storage.getItem(BASE_STORAGE_KEY)!).state
}

describe('Bases persistence', () => {
  it('restores locks, cross-module routes, tunnels, products, disabled I/O, drone cargo and notes without session history', () => {
    const storage = memoryStorage()
    const original = populated(storage)
    const saved = savedDocument(storage)
    const restored = createBaseDesignerStore(() => storage).getState()
    expect({ stations: restored.stations, notes: restored.notes }).toEqual(saved)
    expect(restored.past).toEqual([])
    expect(restored.future).toEqual([])
    expect(original.getState().past.length).toBeGreaterThan(0)
    expect(Object.keys(JSON.parse(storage.getItem(BASE_STORAGE_KEY)!))).toEqual(['state', 'version'])
    expect(Object.keys(saved)).toEqual(['stations', 'notes'])
  })

  it('uses new identities after reload and persists undo/redo and an empty document', () => {
    const storage = memoryStorage()
    populated(storage)
    const store = createBaseDesignerStore(() => storage)
    const ids = new Set(
      [...store.getState().stations, ...store.getState().notes, ...store.getState().stations.flatMap((s) => s.placements)].map((p) => p.id),
    )
    const note = store.getState().addNote({ x: 0, y: 0 })
    expect(ids.has(note)).toBe(false)
    store.getState().undo()
    expect(savedDocument(storage).notes.some((p: { id: string }) => p.id === note)).toBe(false)
    store.getState().redo()
    expect(savedDocument(storage).notes.some((p: { id: string }) => p.id === note)).toBe(true)
    store.setState({ stations: [], notes: [] })
    expect(createBaseDesignerStore(() => storage).getState().stations).toEqual([])
    expect(savedDocument(storage)).toEqual({ stations: [], notes: [] })
  })

  it.each([
    ['malformed JSON', '{broken', 'invalid'],
    ['invalid layout', JSON.stringify({ version: BASE_STORAGE_VERSION, state: { stations: [{}], notes: [] } }), 'invalid'],
    ['future version', JSON.stringify({ version: BASE_STORAGE_VERSION + 1, state: { stations: [], notes: [] } }), 'newer'],
  ])('preserves %s without crashing or overwriting it', async (_, raw, issue) => {
    const storage = memoryStorage()
    storage.setItem(BASE_STORAGE_KEY, raw)
    const store = createBaseDesignerStore(() => storage)
    await Promise.resolve()
    expect(store.getState().storageIssue).toBe(issue)
    store.getState().addNote({ x: 0, y: 0 })
    expect(store.getState().notes).toHaveLength(1)
    expect(storage.getItem(BASE_STORAGE_KEY)).toBe(raw)
  })

  it('keeps editing on storage failure and retries on a later commit', async () => {
    const storage = memoryStorage()
    const write = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    const store = createBaseDesignerStore(() => storage)
    store.getState().addNote({ x: 0, y: 0 })
    await Promise.resolve()
    expect(store.getState().notes).toHaveLength(1)
    expect(store.getState().storageIssue).toBe('unavailable')
    write.mockRestore()
    store.getState().addNote({ x: 20, y: 20 })
    await Promise.resolve()
    expect(store.getState().storageIssue).toBeNull()
    expect(createBaseDesignerStore(() => storage).getState().notes).toHaveLength(2)
  })

  it("preserves another tab's newer work rather than silently overwriting it", async () => {
    const storage = memoryStorage()
    const first = createBaseDesignerStore(() => storage)
    const second = createBaseDesignerStore(() => storage)
    first.getState().addNote({ x: 0, y: 0 })
    const accepted = storage.getItem(BASE_STORAGE_KEY)
    second.getState().addNote({ x: 20, y: 0 })
    await Promise.resolve()
    expect(second.getState().storageIssue).toBe('conflict')
    expect(storage.getItem(BASE_STORAGE_KEY)).toBe(accepted)
    first.getState().addNote({ x: 40, y: 0 })
    await Promise.resolve()
    expect(first.getState().storageIssue).toBeNull()
    expect(createBaseDesignerStore(() => storage).getState().notes).toHaveLength(2)
  })

  it('rejects duplicate IDs, impossible geometry and incomplete tunnels atomically', () => {
    const storage = memoryStorage()
    populated(storage)
    const duplicate = savedDocument(storage)
    duplicate.notes[0].id = duplicate.stations[0].id
    expect(decodeBaseLayout(duplicate)).toBeNull()
    const overlap = savedDocument(storage)
    overlap.stations[1].position = overlap.stations[0].position
    expect(decodeBaseLayout(overlap)).toBeNull()
    const tunnel = savedDocument(storage)
    tunnel.stations[0].placements = tunnel.stations[0].placements.filter(
      (p: { type: string; routeIndex?: number }) => p.type !== 'underground' || p.routeIndex !== 0,
    )
    expect(decodeBaseLayout(tunnel)).toBeNull()
  })

  it('strips transient placement ownership and does not rewrite storage for session-only updates', () => {
    const storage = memoryStorage()
    const store = populated(storage)
    const raw = savedDocument(storage)
    raw.stations[0].placements[0].stationId = 'temporary-world-owner'
    expect(decodeBaseLayout(raw)?.stations[0].placements[0]).not.toHaveProperty('stationId')
    const write = vi.spyOn(storage, 'setItem')
    store.setState({ future: [] })
    expect(write).not.toHaveBeenCalled()
  })
})
