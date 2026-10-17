import type Konva from 'konva'
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { CELL_SIZE, snapToGrid, type Point, type Scene, type Selection, type Station } from '../../model/scene'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import { selectionScene } from '../../lib/selection'
import { groupBounds, translateGroup } from '../../lib/scene-geometry'
import { proposeSelectionTransform } from '../../lib/selection-transform'
import { snapStation } from '../../lib/stations'
import type { EditorTool } from '../../lib/tool-drafts'
import { updateViewport } from './viewport'
import { paintHighlights } from '../elements/highlight'

/** One native Konva carrier moves complete snapshots; React changes only at drag start/end or when the error changes. */
export function useSelectionMove({
  stageRef,
  groupRef,
  scene,
  tool,
  ready,
  selections,
  select,
  feedback,
  previewScene,
}: {
  stageRef: RefObject<Konva.Stage | null>
  groupRef: RefObject<Konva.Group | null>
  scene: Scene
  tool: EditorTool
  ready: boolean
  selections: readonly Selection[]
  select: (items: readonly Selection[]) => void
  feedback: (message: string | null) => void
  previewScene: (stations: readonly Station[] | null) => void
}) {
  const [snapshot, setSnapshot] = useState<Scene | null>(null)
  const gesture = useRef<{
    from: Scene
    targets: readonly Selection[]
    origin: Point
    start: Point
    screen: Point
    offset: Point
    moving: boolean
    hiddenNodes?: readonly Konva.Node[]
  } | null>(null)
  const skipClick = useRef(false)
  /** Restore hidden originals and discard the carrier; cancellation never confirms its last destination. */
  const cancel = useCallback(() => {
    const current = gesture.current,
      stage = stageRef.current
    if (current?.moving) skipClick.current = true
    gesture.current = null
    if (current?.hiddenNodes) {
      for (const node of current.hiddenNodes) node.setAttr('dragHidden', false)
      if (stage) updateViewport(stage, current.hiddenNodes)
    }
    const group = groupRef.current
    if (group) {
      group.draggable(false)
      group.visible(false)
    }
    setSnapshot(null)
    previewScene(null)
  }, [groupRef, previewScene, stageRef])

  useLayoutEffect(() => {
    const stage = stageRef.current
    stage?.on('cancelSelectionGesture.move', cancel)
    const blur = () => cancel()
    // A fast/outside release can arrive before React mounts the native carrier.
    const release = (event: MouseEvent) => {
      if (event.button === 0 && gesture.current && !groupRef.current) cancel()
    }
    window.addEventListener('blur', blur)
    window.addEventListener('mouseup', release)
    return () => {
      stage?.off('.move')
      window.removeEventListener('blur', blur)
      window.removeEventListener('mouseup', release)
      cancel()
    }
  }, [scene.stations, scene.buildings, scene.belts, scene.splitters, scene.tunnels, tool, ready, cancel, stageRef, groupRef])

  /** Begin capture only; an ordinary click still selects, and Shift on floor always starts the selection box. */
  function down(event: Konva.KonvaEventObject<MouseEvent>, picked?: Selection): boolean {
    skipClick.current = false
    if (
      tool.kind !== 'select' ||
      event.evt.button !== 0 ||
      !picked ||
      event.evt.ctrlKey ||
      event.evt.metaKey ||
      (picked.kind === 'station' && event.evt.shiftKey)
    )
      return false
    const already = selections.some((target) => target.id === picked.id)
    if (picked.kind === 'station' && !already) return false
    const targets = (already ? selections : [picked]).filter((item) => !event.evt.shiftKey || item.kind !== 'station'),
      selected = selectionScene(scene, targets),
      bounds = selected && groupBounds(selected),
      start = stageRef.current?.getRelativePointerPosition(),
      screen = stageRef.current?.getPointerPosition()
    if (!selected || !bounds || !start || !screen) return false
    gesture.current = { from: scene, targets, origin: { x: bounds.x, y: bounds.y }, start, screen, offset: { x: 0, y: 0 }, moving: false }
    return true
  }

  /** Cross a screen-pixel threshold before mounting the carrier, so an ordinary click remains a selection. */
  function move() {
    const current = gesture.current,
      stage = stageRef.current,
      screen = stage?.getPointerPosition()
    if (!current || !stage || !screen || current.moving) return
    if (Math.hypot(screen.x - current.screen.x, screen.y - current.screen.y) < 3) return
    current.moving = true
    skipClick.current = true
    const selected = selectionScene(current.from, current.targets)
    if (!selected) return cancel()
    select(current.targets)
    feedback(null)
    setSnapshot(translateGroup(selected, { x: -current.origin.x, y: -current.origin.y }))
  }

  useLayoutEffect(() => {
    const current = gesture.current,
      group = groupRef.current,
      stage = stageRef.current,
      pointer = stage?.getRelativePointerPosition()
    if (!snapshot || !current || !group || !stage || !pointer) return
    const ids = new Set(current.targets.map((target) => target.id))
    // Only confirmed nodes have viewport membership; the carrier must never hide itself.
    current.hiddenNodes = stage.find('.viewport-element').filter((node) => {
      const owner: Selection | undefined = node.getAttr('selection'),
        owners: readonly string[] = node.getAttr('dragOwners') ?? []
      return (owner && ids.has(owner.id)) || owners.some((id) => ids.has(id))
    })
    for (const node of current.hiddenNodes) node.setAttrs({ dragHidden: true, visible: false })
    group.setAttrs({
      x: current.origin.x * CELL_SIZE + pointer.x - current.start.x,
      y: current.origin.y * CELL_SIZE + pointer.y - current.start.y,
      visible: true,
      draggable: true,
    })
    group.startDrag()
    // The floor layer paints provisional joins; avoid duplicating them in the carrier.
    group.findOne<Konva.Shape>('.station-corridors')?.setAttrs({ corridors: [] })
  }, [snapshot, groupRef, stageRef])

  /** Quantize only when entering another cell. The final-scene scan is never run for every raw pointer event. */
  function dragMove() {
    const current = gesture.current,
      group = groupRef.current
    if (!current || !group) return
    let point = snapToGrid(group.position())
    if (current.targets.length === 1 && current.targets[0].kind === 'station') {
      const station = current.from.stations.find((item) => item.id === current.targets[0].id)
      if (station) point = snapStation(current.from.stations, { ...station, ...point }, station.id)
    }
    group.position({ x: point.x * CELL_SIZE, y: point.y * CELL_SIZE })
    const offset = { x: point.x - current.origin.x, y: point.y - current.origin.y }
    if (offset.x === current.offset.x && offset.y === current.offset.y && group.getAttr('validated')) return
    current.offset = offset
    group.setAttr('validated', true)
    const proposal = proposeSelectionTransform(useBaseDesignerStore.getState(), current.targets, { kind: 'move', offset }, current.from)
    paintHighlights(group, proposal.issue ? '#ef7373' : '#f4b055')
    feedback(proposal.issue)
    // Invalid destinations still move provisional doors; old corridors must not remain at the hidden origin.
    const ids = new Set(current.targets.map((target) => target.id))
    previewScene(
      current.from.stations.map((station) =>
        ids.has(station.id) ? { ...station, x: station.x + offset.x, y: station.y + offset.y } : station,
      ),
    )
  }

  /** Drain the final snapped offset, ask the store to commit once, then restore normal scene rendering. */
  function dragEnd() {
    const current = gesture.current,
      group = groupRef.current
    if (current && group?.draggable()) {
      dragMove()
      useBaseDesignerStore.getState().transformElements(current.targets, { kind: 'move', offset: current.offset }, current.from)
    }
    cancel()
  }

  return {
    snapshot,
    down,
    move,
    dragMove,
    dragEnd,
    cancel,
    consumeClick: () => skipClick.current,
    up: () => {
      if (gesture.current && !gesture.current.moving) gesture.current = null
    },
  }
}
