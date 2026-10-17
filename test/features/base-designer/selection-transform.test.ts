import { describe, expect, it } from 'vitest'
import { rotateGroup, selectionPivot } from '@/features/base-designer/lib/scene-geometry'
import { proposeSelectionTransform } from '@/features/base-designer/lib/selection-transform'
import { allSelections } from '@/features/base-designer/lib/selection'
import { canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import { mixedScene } from './scene-fixture'

describe('Grid-preserving selection transforms', () => {
  it('rotates complete mixed geometry around one stable pivot and returns exactly after four turns', () => {
    const original = mixedScene(),
      before = structuredClone(original)
    const pivot = selectionPivot(original)
    expect(pivot).toEqual({ x: 27, y: 15 })
    let scene = original
    for (let turn = 1; turn <= 4; turn++) {
      const proposal = proposeSelectionTransform(scene, allSelections(scene), { kind: 'rotate', pivot })
      expect(proposal.issue).toBeNull()
      expect(proposal.scene).not.toBeNull()
      scene = proposal.scene as Required<typeof original>
      expect(canPlaceScenePieces(scene)).toBe(true)
      if (turn === 1) {
        expect(scene.buildings[0]).toMatchObject({
          id: 'machine',
          stationId: 'floor',
          x: 38,
          y: -11,
          rotation: 180,
          disabledOutputs: ['1:1'],
        })
        expect(scene.belts[0].points).toEqual([
          { x: 34, y: -11 },
          { x: 34, y: -8 },
          { x: 31, y: -8 },
        ])
        expect(scene.belts[1]).toMatchObject({ points: [{ x: 29, y: -11 }], heading: { x: -0, y: 1 } })
        expect(scene.tunnels[0]).toMatchObject({ entry: { x: 31, y: -4 }, exit: { x: 31, y: -1 }, disabledOutputs: ['exit'] })
        expect(scene.stations[1]).toMatchObject({ id: 'drone', x: 28, y: 28, rotation: 180, cargo: ['T_CobaltOre', null] })
      }
    }
    expect(scene).toEqual(original)
    expect(original).toEqual(before)
  })

  it('adjusts one half-cell pivot axis for uneven bounds, keeping every turn on the integer grid', () => {
    const original = {
      stations: [],
      buildings: [],
      belts: [
        {
          id: 'L',
          points: [
            { x: 1, y: 5 },
            { x: 5, y: 5 },
            { x: 5, y: 8 },
          ],
        },
      ],
      splitters: [],
      tunnels: [],
    }
    const pivot = selectionPivot(original)
    expect(pivot).toEqual({ x: 3.5, y: 7.5 })
    let scene = rotateGroup(original, pivot)
    expect(scene.belts[0].points).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 9 },
      { x: 2, y: 9 },
    ])
    for (let turn = 1; turn < 4; turn++) scene = rotateGroup(scene, pivot)
    expect(scene).toEqual(original)
  })

  it('aligns an individual splitter with an inline belt but preserves a group orientation', () => {
    const scene = {
      stations: [{ id: 'floor', x: 0, y: 0 }],
      buildings: [],
      belts: [
        {
          id: 'route',
          points: [
            { x: 1, y: 7 },
            { x: 10, y: 7 },
          ],
        },
      ],
      splitters: [{ id: 'splitter', type: 'splitter' as const, x: 5, y: 4, rotation: 90 as const }],
      tunnels: [{ id: 'tunnel', type: 'underground' as const, entry: { x: 1, y: 1 }, exit: { x: 4, y: 1 } }],
    }
    expect(canPlaceScenePieces(scene)).toBe(true)
    const transform = { kind: 'move' as const, offset: { x: 0, y: 3 } }
    const individual = proposeSelectionTransform(scene, [{ kind: 'splitter', id: 'splitter' }], transform)
    expect(individual.issue).toBeNull()
    expect(individual.scene?.splitters?.[0].rotation).toBe(0)
    const group = proposeSelectionTransform(
      scene,
      [
        { kind: 'splitter', id: 'splitter' },
        { kind: 'tunnel', id: 'tunnel' },
      ],
      transform,
    )
    expect(group.scene).toBeNull()
    expect(group.issue).toBeTruthy()
    expect(scene.splitters[0].rotation).toBe(90)
  })
})
