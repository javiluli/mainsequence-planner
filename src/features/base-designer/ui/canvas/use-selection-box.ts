import type Konva from 'konva'
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import type { Point, Scene, Selection } from '../../model/scene'
import type { EditorTool } from '../../lib/tool-drafts'

/** Native rectangle owns only a gesture. Membership is calculated once at release, with no React updates while drawing. */
export function useSelectionBox({
  stageRef,
  rectangleRef,
  tool,
  ready,
  scene,
  selectArea,
}: {
  stageRef: RefObject<Konva.Stage | null>
  rectangleRef: RefObject<Konva.Rect | null>
  tool: EditorTool
  ready: boolean
  scene: Scene
  selectArea: (from: Point, to: Point, piecesOnly: boolean) => void
}) {
  const gesture = useRef<{ start: Point; screen: Point; moved: boolean } | null>(null)
  const skipClick = useRef(false)

  /** Leaving, changing tools or tearing down cancels without changing the existing selection. */
  const cancel = useCallback(() => {
    if (gesture.current?.moved) skipClick.current = true
    gesture.current = null
    rectangleRef.current?.visible(false)
    rectangleRef.current?.getLayer()?.batchDraw()
  }, [rectangleRef])
  useLayoutEffect(() => {
    cancel()
    const stage = stageRef.current
    stage?.on('cancelSelectionGesture.box', cancel)
    window.addEventListener('blur', cancel)
    return () => {
      stage?.off('.box')
      window.removeEventListener('blur', cancel)
      cancel()
    }
  }, [tool, ready, cancel, stageRef, scene.stations, scene.buildings, scene.belts, scene.splitters, scene.tunnels])

  /** Capture free floor only when the same press has not been claimed by a piece or station drag. */
  function down(event: Konva.KonvaEventObject<MouseEvent>, picked: Selection | undefined, dragStation: boolean) {
    skipClick.current = false
    if (event.evt.button !== 0 || tool.kind !== 'select' || (picked && (picked.kind !== 'station' || dragStation))) return
    const start = stageRef.current?.getRelativePointerPosition(),
      screen = stageRef.current?.getPointerPosition()
    if (start && screen) gesture.current = { start, screen, moved: false }
  }
  /** Keep the drag threshold in screen pixels while drawing the rectangle in world pixels at any zoom. */
  function move() {
    const current = gesture.current
    if (!current) return
    const stage = stageRef.current,
      shape = rectangleRef.current
    const world = stage?.getRelativePointerPosition(),
      screen = stage?.getPointerPosition()
    if (!shape || !world || !screen) return
    current.moved ||= Math.hypot(screen.x - current.screen.x, screen.y - current.screen.y) >= 3
    shape.setAttrs({
      visible: current.moved,
      x: Math.min(current.start.x, world.x),
      y: Math.min(current.start.y, world.y),
      width: Math.abs(world.x - current.start.x),
      height: Math.abs(world.y - current.start.y),
    })
    shape.getLayer()?.batchDraw()
  }
  /** Resolve contact once at release; Shift excludes floors and the following click must not replace the result. */
  function up(event: Konva.KonvaEventObject<MouseEvent>) {
    if (event.evt.button !== 0) return
    move()
    const current = gesture.current,
      end = stageRef.current?.getRelativePointerPosition()
    if (current?.moved && end) {
      selectArea(current.start, end, event.evt.shiftKey)
      skipClick.current = true
    }
    cancel()
  }
  return { down, move, up, cancel, consumeClick: () => skipClick.current }
}
