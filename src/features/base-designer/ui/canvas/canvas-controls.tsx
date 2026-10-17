import { Button, Tooltip } from '@heroui/react'
import type Konva from 'konva'
import { Focus, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useState, type ReactNode, type RefObject } from 'react'

/** Only the zoom label observes native camera changes; scene components never rerender for camera input. */
export function CanvasControls({
  commands,
  stageRef,
  onZoom,
  onCenter,
}: {
  commands: ReactNode
  stageRef: RefObject<Konva.Stage | null>
  onZoom: (factor: number) => void
  onCenter: () => void
}) {
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let frame: number | null = null
    const update = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        setZoom(stage.scaleX())
      })
    }
    update()
    stage.on('scaleXChange.canvas-controls', update)
    return () => {
      stage.off('.canvas-controls')
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [stageRef])
  return (
    <div
      role="toolbar"
      aria-label="Canvas actions"
      className="absolute right-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-0.5 rounded-md border border-divider bg-content1 p-1 shadow-md"
    >
      {commands}
      <Tooltip content="Center scene at 100% (C)">
        <Button isIconOnly size="sm" variant="light" aria-label="Center scene" onPress={onCenter}>
          <Focus size={16} aria-hidden />
        </Button>
      </Tooltip>
      <span className="mx-1 h-5 border-l border-divider" aria-hidden />
      <Tooltip content="Zoom out">
        <Button isIconOnly size="sm" variant="light" aria-label="Zoom out" onPress={() => onZoom(1 / 1.2)}>
          <ZoomOut size={16} aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip content="Reset zoom">
        <Button
          size="sm"
          variant="light"
          className="min-w-12 px-2 text-xs tabular-nums"
          aria-label={`Reset zoom, currently ${Math.round(zoom * 100)} percent`}
          onPress={() => onZoom(1 / (stageRef.current?.scaleX() ?? 1))}
        >
          {Math.round(zoom * 100)}%
        </Button>
      </Tooltip>
      <Tooltip content="Zoom in">
        <Button isIconOnly size="sm" variant="light" aria-label="Zoom in" onPress={() => onZoom(1.2)}>
          <ZoomIn size={16} aria-hidden />
        </Button>
      </Tooltip>
    </div>
  )
}
