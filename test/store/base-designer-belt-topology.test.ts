import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBaseDesignerStore } from '@/store/base-designer.store'
import { beltCells } from '@/features/base-designer/lib/belts'
import { beltNetwork } from '@/features/base-designer/lib/belt-network'
import { canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import { readSceneDocument, writeSceneDocument } from '@/features/base-designer/lib/scene-document'

afterEach(() => vi.restoreAllMocks())

/** Start from one real large floor so route-cut and continuation fixtures share valid support. */
function editor() {
  const store = createBaseDesignerStore()
  store.getState().addStation({ type: 'station_2x2_a', x: 0, y: 0 })
  return store
}

describe('Splitter route cuts', () => {
  it('normalizes neighboring legacy inline housings only when their lane is cut', () => {
    const store = editor()
    store.setState({
      belts: [
        {
          id: 'legacy-route',
          points: [
            { x: 2, y: 5 },
            { x: 10, y: 5 },
          ],
        },
      ],
      splitters: [{ id: 'legacy-splitter', type: 'splitter', x: 5, y: 5, rotation: 0 }],
    })
    expect(canPlaceScenePieces(store.getState())).toBe(true)
    const before = store.getState()
    expect(before.addSplitter({ type: 'splitter', x: 6, y: 5, rotation: 0 })).toBeTruthy()
    const scene = store.getState()
    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(scene.belts.map((belt) => belt.points)).toEqual([
      [
        { x: 2, y: 5 },
        { x: 4, y: 5 },
      ],
      [
        { x: 7, y: 5 },
        { x: 10, y: 5 },
      ],
    ])
    expect(beltNetwork(scene).links.get('5,5')).toContain('6,5')
    expect(readSceneDocument(JSON.parse(writeSceneDocument(scene)))).not.toBeNull()
    expect(scene.undo()).toBe(true)
    expect(store.getState().belts).toBe(before.belts)
  })

  it.each([4, 6])('preserves a mixed-tier T when cutting immediately beside it (splitter x=%s)', (x) => {
    const store = editor()
    store.getState().addBelt({
      type: 'conveyor_mk2',
      points: [
        { x: 1, y: 5 },
        { x: 10, y: 5 },
      ],
    })
    store.getState().addBelt({
      type: 'conveyor',
      points: [
        { x: 5, y: 2 },
        { x: 5, y: 5 },
      ],
    })
    expect(store.getState().addSplitter({ type: 'splitter_mk2', rotation: 0, x, y: 5 })).toBeTruthy()
    const scene = store.getState()
    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(readSceneDocument(JSON.parse(writeSceneDocument(scene)))).not.toBeNull()
    const network = beltNetwork(scene)
    expect(network.links.get(x - 1 + ',5')).toContain(x + ',5')
    expect(network.links.get(x + ',5')).toContain(x + 1 + ',5')
    expect(network.capacities.get('5,5')).toBe(120)
  })

  it.each(['conveyor', 'conveyor_mk2'] as const)('cuts the actual %s footprint and restores the whole transaction', (type) => {
    const store = editor()
    const id = store.getState().addBelt({
      type,
      points: [
        { x: 2, y: 2 },
        { x: 2, y: 5 },
        { x: 10, y: 5 },
        { x: 10, y: 9 },
      ],
    })!
    const before = store.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    const splitter = before.addSplitter({ type: 'splitter', rotation: 90, x: 5, y: 5 })!
    const after = store.getState()
    expect(after.belts).toEqual([
      {
        id,
        type,
        points: [
          { x: 2, y: 2 },
          { x: 2, y: 5 },
          { x: 4, y: 5 },
        ],
      },
      {
        id: expect.any(String),
        type,
        points: [
          { x: 6, y: 5 },
          { x: 10, y: 5 },
          { x: 10, y: 9 },
        ],
      },
    ])
    expect(ids).toHaveBeenCalledTimes(2)
    expect(after.splitters[0]).toMatchObject({ id: splitter, rotation: 0 })
    expect(after.belts.flatMap((belt) => beltCells(belt.points) ?? []).some((cell) => cell.x === 5 && cell.y === 5)).toBe(false)
    expect(canPlaceScenePieces(after)).toBe(true)
    const network = beltNetwork(after)
    expect(network.links.get('4,5')).toContain('5,5')
    expect(network.links.get('5,5')).toContain('6,5')
    expect(after.past).toHaveLength(before.past.length + 1)
    expect(readSceneDocument(JSON.parse(writeSceneDocument(after)))?.belts).toEqual(after.belts)
    expect(after.undo()).toBe(true)
    expect(store.getState().belts).toBe(before.belts)
    expect(store.getState().splitters).toBe(before.splitters)
    expect(store.getState().redo()).toBe(true)
    expect(store.getState().belts).toBe(after.belts)
    expect(store.getState().setPortOutput({ kind: 'splitter', id: splitter }, 'east', false)).toBe(true)
    expect(beltNetwork(store.getState()).links.get('5,5') ?? []).not.toContain('6,5')
    expect(store.getState().removeElements([{ kind: 'splitter', id: splitter }])).toBe(true)
    expect(store.getState().belts).toBe(after.belts)
  })

  it.each([
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ])('keeps one-cell fragment directions %j', (heading) => {
    const store = editor()
    const center = { x: 6, y: 6 }
    const from = { x: center.x - heading.x, y: center.y - heading.y },
      to = { x: center.x + heading.x, y: center.y + heading.y }
    store.getState().addBelt({ type: 'conveyor_mk2', points: [from, to] })
    expect(store.getState().addSplitter({ type: 'splitter_mk2', rotation: 0, ...center })).toBeTruthy()
    const scene = store.getState()
    expect(scene.belts.map((belt) => ({ points: belt.points, heading: belt.heading }))).toEqual([
      { points: [from], heading },
      { points: [to], heading },
    ])
    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(readSceneDocument(JSON.parse(writeSceneDocument(scene)))).not.toBeNull()
  })

  it('keeps a one-cell fragment valid at a mixed-tier junction', () => {
    const store = editor()
    store.getState().addBelt({
      points: [
        { x: 2, y: 5 },
        { x: 5, y: 5 },
      ],
    })
    store.getState().addBelt({
      type: 'conveyor_mk2',
      points: [
        { x: 5, y: 5 },
        { x: 9, y: 5 },
      ],
    })
    expect(store.getState().addSplitter({ type: 'splitter', rotation: 0, x: 6, y: 5 })).toBeTruthy()
    expect(store.getState().belts).toHaveLength(3)
    expect(canPlaceScenePieces(store.getState())).toBe(true)
    expect(beltNetwork(store.getState()).links.get('5,5')).toContain('6,5')
    expect(beltNetwork(store.getState()).capacities.get('5,5')).toBe(120)
    expect(readSceneDocument(JSON.parse(writeSceneDocument(store.getState())))).not.toBeNull()
  })

  it.each(['move', 'paste'] as const)('cuts existing lanes when a splitter is placed through %s', (method) => {
    const store = editor()
    const id = store.getState().addSplitter({ type: 'splitter', x: 6, y: 2, rotation: 90 })!
    store.getState().addBelt({
      points: [
        { x: 2, y: 5 },
        { x: 10, y: 5 },
      ],
    })
    const before = store.getState()
    if (method === 'move') expect(before.transformElements([{ kind: 'splitter', id }], { kind: 'move', offset: { x: 0, y: 3 } })).toBe(true)
    else
      expect(
        before.pasteGroup(
          { stations: [], buildings: [], belts: [], splitters: [{ id: 'template', type: 'splitter', x: 0, y: 0, rotation: 0 }] },
          { x: 6, y: 5 },
        ),
      ).toHaveLength(1)
    expect(store.getState().belts).toHaveLength(2)
    expect(store.getState().past).toHaveLength(before.past.length + 1)
    expect(canPlaceScenePieces(store.getState())).toBe(true)
  })

  it('retains complete legacy group routes and IDs when moving an already inline splitter with its lane', () => {
    const store = editor()
    const scene = {
      ...store.getState(),
      belts: [
        {
          id: 'old',
          points: [
            { x: 2, y: 5 },
            { x: 10, y: 5 },
          ],
        },
      ],
      splitters: [{ id: 'split', type: 'splitter' as const, x: 6, y: 5, rotation: 0 as const }],
    }
    store.setState(scene)
    expect(
      store.getState().transformElements(
        [
          { kind: 'belt', id: 'old' },
          { kind: 'splitter', id: 'split' },
        ],
        { kind: 'move', offset: { x: 0, y: 3 } },
      ),
    ).toBe(true)
    expect(store.getState().belts.map((belt) => belt.id)).toEqual(['old'])
    expect(canPlaceScenePieces(store.getState())).toBe(true)
  })

  it('rejects an endpoint or bend without IDs, notifications, history or partial cuts', () => {
    const store = editor()
    store.getState().addBelt({
      points: [
        { x: 2, y: 2 },
        { x: 2, y: 5 },
        { x: 10, y: 5 },
      ],
    })
    const before = store.getState(),
      ids = vi.spyOn(crypto, 'randomUUID'),
      notified = vi.fn()
    store.subscribe(notified)
    for (const point of [
      { x: 2, y: 2 },
      { x: 2, y: 5 },
    ])
      expect(before.addSplitter({ type: 'splitter', rotation: 0, ...point })).toBeNull()
    expect(store.getState()).toBe(before)
    expect(ids).not.toHaveBeenCalled()
    expect(notified).not.toHaveBeenCalled()
  })
})

describe('Single-route continuations', () => {
  it('does not treat an extra caller-owned ID as permission to overwrite another route', () => {
    const store = editor()
    store.getState().addBelt({
      points: [
        { x: 2, y: 5 },
        { x: 5, y: 5 },
      ],
    })
    const before = store.getState(),
      original = before.belts[0]
    const proposal = {
      ...original,
      points: [
        { x: 2, y: 9 },
        { x: 5, y: 9 },
      ],
    }
    expect(before.addBelt(proposal)).not.toBe(original.id)
    expect(store.getState().belts).toHaveLength(2)
    expect(store.getState().belts[0]).toBe(original)
  })

  it.each(['conveyor', 'conveyor_mk2'] as const)('joins an added %s continuation without allocating a second ID', (type) => {
    const store = editor()
    const id = store.getState().addBelt({
      type,
      points: [
        { x: 2, y: 5 },
        { x: 5, y: 5 },
      ],
    })!
    const before = store.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    expect(
      before.addBelt({
        type,
        points: [
          { x: 5, y: 5 },
          { x: 8, y: 5 },
          { x: 8, y: 8 },
        ],
      }),
    ).toBe(id)
    const after = store.getState()
    expect(after.belts).toEqual([
      {
        id,
        type,
        points: [
          { x: 2, y: 5 },
          { x: 5, y: 5 },
          { x: 8, y: 5 },
          { x: 8, y: 8 },
        ],
      },
    ])
    expect(ids).not.toHaveBeenCalled()
    expect(after.past).toHaveLength(before.past.length + 1)
    expect(after.undo()).toBe(true)
    expect(store.getState().belts).toBe(before.belts)
    expect(store.getState().redo()).toBe(true)
    expect(store.getState().belts).toBe(after.belts)
  })

  it.each(['add', 'extend'] as const)('joins both sides when bridging an existing gap through %s', (method) => {
    const store = editor()
    const first = [
      { x: 2, y: 5 },
      { x: 5, y: 5 },
    ]
    const id = store.getState().addBelt({ points: first })!
    store.getState().addBelt({
      points: [
        { x: 8, y: 5 },
        { x: 11, y: 5 },
      ],
    })
    const before = store.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    if (method === 'add')
      expect(
        before.addBelt({
          points: [
            { x: 5, y: 5 },
            { x: 8, y: 5 },
          ],
        }),
      ).toBe(id)
    else expect(before.extendBelt({ id, from: first, points: [...first, { x: 8, y: 5 }] })).toBe(true)
    expect(store.getState().belts).toEqual([
      {
        id,
        points: [
          { x: 2, y: 5 },
          { x: 5, y: 5 },
          { x: 8, y: 5 },
          { x: 11, y: 5 },
        ],
      },
    ])
    expect(ids).not.toHaveBeenCalled()
    expect(canPlaceScenePieces(store.getState())).toBe(true)
    expect(readSceneDocument(JSON.parse(writeSceneDocument(store.getState())))).not.toBeNull()
  })

  it('keeps mixed tiers and true T branches as independent routes', () => {
    const store = editor()
    const id = store.getState().addBelt({
      points: [
        { x: 2, y: 5 },
        { x: 7, y: 5 },
      ],
    })!
    const peer = store.getState().addBelt({
      type: 'conveyor_mk2',
      points: [
        { x: 7, y: 5 },
        { x: 11, y: 5 },
      ],
    })!
    expect(peer).not.toBe(id)
    const branch = store.getState().addBelt({
      points: [
        { x: 5, y: 2 },
        { x: 5, y: 5 },
      ],
    })!
    expect(branch).not.toBe(id)
    expect(store.getState().belts).toHaveLength(3)
    expect(canPlaceScenePieces(store.getState())).toBe(true)
  })
})
