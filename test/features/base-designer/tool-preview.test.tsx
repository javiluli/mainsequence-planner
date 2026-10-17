// @vitest-environment jsdom
import { act } from '@testing-library/react'
import Konva from 'konva'
import type { ReactNode } from 'react'
import { KonvaRenderer } from 'react-konva'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { paintPreview } from '@/features/base-designer/ui/tools/preview'
import { ToolPreview } from '@/features/base-designer/ui/tools/tool-preview'
import type { EditorTool } from '@/features/base-designer/lib/tool-drafts'
import type { Scene } from '@/features/base-designer/model/scene'
import type { BeltSection } from '@/features/base-designer/ui/elements/belt-geometry'

afterEach(() => vi.restoreAllMocks())

/** Reconcile real Konva nodes without a Stage; text metrics and pixel painting belong to browser verification. */
function preview() {
  vi.spyOn(Konva.Util, 'isCanvasFarblingActive').mockReturnValue(false)
  vi.spyOn(Konva.Text.prototype, '_setTextData').mockImplementation(() => {})
  const host = new Konva.Group(),
    groupRef = { current: null as Konva.Group | null },
    failed = (error: unknown) => {
      throw error
    },
    root = KonvaRenderer.createContainer(host, 1, null, false, null, '', failed, failed, failed, () => {}, null)
  const render = async (children: ReactNode) => {
    await act(async () => {
      KonvaRenderer.updateContainer(children, root, null)
    })
  }
  const draw = (tool: EditorTool, image: CanvasImageSource | null = null) =>
    render(<ToolPreview tool={tool} groupRef={groupRef} image={image} corridorImage={null} droneImage={null} />)
  return {
    groupRef,
    draw,
    dispose: async () => {
      await render(null)
      host.destroy()
    },
  }
}

describe('Native belt preview ownership', () => {
  it('keeps the hovered route through feedback/artwork renders and recovers from invalid to valid', async () => {
    const { groupRef, draw, dispose } = preview(),
      scene: Scene = { stations: [{ id: 'floor', x: 0, y: 0 }], buildings: [], belts: [] },
      tool: EditorTool = { kind: 'belt', points: [{ x: 2, y: 3 }] }
    try {
      await draw(tool)
      const group = groupRef.current!,
        track = group.findOne<Konva.Shape>('.outline')!
      expect(paintPreview(group, tool, scene, { x: 310, y: 70 })).toBeTruthy()
      const invalid = track.getAttr('geometry') as readonly (readonly BeltSection[])[]
      expect(invalid[0].length).toBeGreaterThan(0)
      expect(track.stroke()).toBe('#ef7373')
      await draw(tool)
      expect(track.getAttr('geometry')).toBe(invalid)
      expect(group.visible()).toBe(true)
      await draw(tool, document.createElement('canvas'))
      expect(track.getAttr('geometry')).toBe(invalid)

      expect(paintPreview(group, tool, scene, { x: 170, y: 70 })).toBeNull()
      const valid = track.getAttr('geometry') as readonly (readonly BeltSection[])[]
      expect(valid[0].length).toBeGreaterThan(0)
      expect(track.stroke()).toBe('#f4b055')
      await draw(tool)
      expect(track.getAttr('geometry')).toBe(valid)
      expect(tool.points).toEqual([{ x: 2, y: 3 }])
      expect(scene.belts).toEqual([])
    } finally {
      await dispose()
    }
  })

  it('keeps idle hover empty, updates anchors and tier, and removes the ghost on Escape', async () => {
    const { groupRef, draw, dispose } = preview(),
      scene: Scene = { stations: [{ id: 'floor', x: 0, y: 0 }], buildings: [], belts: [] },
      idle: EditorTool = { kind: 'belt', points: [] },
      started: EditorTool = { kind: 'belt', points: [{ x: 2, y: 3 }] }
    try {
      await draw(idle)
      expect(paintPreview(groupRef.current!, idle, scene, { x: 170, y: 70 })).toBeNull()
      expect(groupRef.current!.findOne<Konva.Shape>('.outline')!.getAttr('geometry')).toEqual([[]])

      await draw(started)
      const group = groupRef.current!,
        track = group.findOne<Konva.Shape>('.outline')!
      paintPreview(group, started, scene, { x: 170, y: 70 })
      const hovered = track.getAttr('geometry') as readonly (readonly BeltSection[])[]
      await draw({ ...started, startNormal: { x: 0, y: 1 } })
      const turned = track.getAttr('geometry') as readonly (readonly BeltSection[])[]
      expect(turned[0].at(-1)?.to).toEqual({ x: 50, y: 80 })
      const anchored: EditorTool = { ...started, points: [...started.points, { x: 4, y: 3 }] }
      await draw(anchored)
      const confirmed = track.getAttr('geometry') as readonly (readonly BeltSection[])[]
      expect(confirmed).not.toBe(hovered)
      expect(confirmed[0].at(-1)?.to).toEqual({ x: 100, y: 70 })
      await draw({ ...anchored, type: 'conveyor_mk2' })
      expect(group.findOne<Konva.Text>('.belt-level')!.text()).toBe('MK2')
      expect(track.getAttr('geometry')).toEqual(confirmed)

      await draw({ kind: 'select' })
      expect(groupRef.current).toBeNull()
      expect(scene.belts).toEqual([])
    } finally {
      await dispose()
    }
  })
})
