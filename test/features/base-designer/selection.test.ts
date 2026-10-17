import { describe, expect, it } from 'vitest'
import { allSelections, selectElement, selectionScene, selectInRectangle } from '@/features/base-designer/lib/selection'
import { captureGroupClipboard, checkGroupPlacement } from '@/features/base-designer/lib/clipboard-group'
import { groupBounds, translateGroup } from '@/features/base-designer/lib/scene-geometry'
import { canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import { mixedScene } from './scene-fixture'

describe('Explicit logical selection', () => {
  it('captures current IDs in scene order without implicitly including floor contents', () => {
    const scene = mixedScene()
    expect(canPlaceScenePieces(scene)).toBe(true)
    const floor = { kind: 'station' as const, id: 'floor' }
    expect(selectionScene(scene, [floor])).toEqual({ stations: [scene.stations[0]], buildings: [], belts: [], splitters: [], tunnels: [] })
    const selection = allSelections(scene)
    expect(selection).toHaveLength(7)
    expect(selectionScene(scene, [...selection].reverse())).toEqual(scene)
    expect(selectionScene(scene, [])).toBeNull()
    expect(selectionScene(scene, [...selection, { kind: 'tunnel', id: 'missing' }])).toBeNull()
    expect(allSelections(scene, true).some((item) => item.kind === 'station')).toBe(false)
  })

  it('toggles explicit targets and removes both floor types when Shift excludes stations', () => {
    const current = allSelections(mixedScene())
    const machine = { kind: 'building' as const, id: 'machine' }
    expect(selectElement(current, machine)).toEqual([machine])
    const toggled = selectElement(current, machine, true)
    expect(toggled.some((item) => item.id === machine.id)).toBe(false)
    expect(selectElement(toggled, machine, true)).toEqual([...toggled, machine])
    expect(selectElement(current, null, true, true)).toEqual(current.filter((item) => item.kind !== 'station'))
    expect(selectElement(current, { kind: 'station', id: 'drone' }, false, true)).toEqual([])
  })

  it('selects whole routes by contact, excludes empty L interiors and ignores buried tunnel guides', () => {
    const scene = mixedScene()
    expect(selectInRectangle(scene, { x: 44, y: 164 }, { x: 56, y: 176 }, true)).toEqual([])
    expect(selectInRectangle(scene, { x: 80, y: 140 }, { x: 85, y: 145 }, true)).toEqual([{ kind: 'belt', id: 'route' }])
    expect(selectInRectangle(scene, { x: 165, y: 205 }, { x: 175, y: 215 }, true)).toEqual([{ kind: 'tunnel', id: 'tunnel' }])
    expect(selectInRectangle(scene, { x: 185, y: 205 }, { x: 195, y: 215 }, true)).toEqual([])
    for (const [id, x] of [
      ['floor', 20],
      ['drone', 42],
    ] as const) {
      const from = { x: x * 20, y: 40 },
        to = { x: (x + 1) * 20, y: 60 }
      expect(selectInRectangle(scene, to, from, false)).toEqual([{ kind: 'station', id }])
      expect(selectInRectangle(scene, from, to, true)).toEqual([])
    }
  })
})

describe('Complete group clipboard proposals', () => {
  it('anchors explicit pieces at logical bounds and rebinds a building to the destination floor', () => {
    const scene = translateGroup(mixedScene(), { x: -50, y: -40 })
    const selection = [
      { kind: 'tunnel' as const, id: 'tunnel' },
      { kind: 'belt' as const, id: 'route' },
      { kind: 'building' as const, id: 'machine' },
    ]
    const before = structuredClone(scene)
    const clipboard = captureGroupClipboard(scene, selection)!
    expect(clipboard.scene.stations).toEqual([])
    expect(groupBounds(clipboard.scene)).toEqual({ x: 0, y: 0, width: 11, height: 10 })
    expect(clipboard.scene.buildings[0]).toMatchObject({
      x: 0,
      y: 0,
      stationId: 'floor',
      recipeId: 'cobalt_plates',
      disabledOutputs: ['1:1'],
    })
    expect(clipboard.scene.belts[0].points).toEqual([
      { x: 0, y: 6 },
      { x: 3, y: 6 },
      { x: 3, y: 9 },
    ])
    expect(clipboard.scene.tunnels[0]).toMatchObject({ entry: { x: 7, y: 9 }, exit: { x: 10, y: 9 }, disabledOutputs: ['exit'] })
    const destination = { stations: [{ id: 'destination', type: 'station_2x2_a' as const, x: -30, y: -30 }], buildings: [], belts: [] }
    const proposal = checkGroupPlacement(destination, clipboard.scene, { x: -29, y: -29 })
    expect(proposal.issue).toBeNull()
    expect(proposal.additions?.buildings[0]).toMatchObject({ stationId: 'destination', x: -29, y: -29 })
    expect(scene).toEqual(before)
    expect(clipboard.scene.belts[0].points).not.toBe(scene.belts[0].points)
    expect(clipboard.scene.tunnels[0].entry).not.toBe(scene.tunnels[0].entry)
  })

  it('uses temporary keys distinct from existing IDs and rejects the entire invalid group', () => {
    const group = mixedScene()
    const scene = { stations: [{ id: 'clipboard:station:0', x: 100, y: 0 }], buildings: [], belts: [] }
    const proposal = checkGroupPlacement(scene, group, { x: 40, y: 40 })
    expect(proposal.issue).toBeNull()
    const additions = proposal.additions!
    expect(additions.stations.some((item) => item.id === scene.stations[0].id)).toBe(false)
    expect(additions.buildings[0].stationId).toBe(additions.stations[0].id)
    for (const point of [
      { x: 100, y: 0 },
      { x: 0.5, y: 0 },
      { x: NaN, y: 0 },
    ]) {
      const invalid = checkGroupPlacement(scene, group, point)
      expect(invalid.additions).toBeNull()
      expect(invalid.issue).toBeTruthy()
    }
    expect(
      checkGroupPlacement(scene, { ...group, belts: [{ id: 'directionless', points: [{ x: 1, y: 7 }] }] }, { x: 0, y: 0 }).additions,
    ).toBeNull()
  })
})
