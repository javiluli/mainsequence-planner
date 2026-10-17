import { useRef } from 'react'
import { Shape } from 'react-konva'
import { CELL_SIZE } from '../../model/scene'

/** Repeat one cell texture in world coordinates; rebuild only for zoom/DPR, keeping one-screen-pixel grid lines. */
export function CanvasGrid() {
  const texture = useRef<{ zoom: number; ratio: number; stroke: string; pattern: CanvasPattern | null } | null>(null)
  return (
    <Shape
      listening={false}
      sceneFunc={(context, shape) => {
        const stage = shape.getStage()
        if (!stage) return
        const zoom = stage.scaleX(),
          ratio = context.canvas.getPixelRatio(),
          left = -stage.x() / zoom,
          top = -stage.y() / zoom,
          right = left + stage.width() / zoom,
          bottom = top + stage.height() / zoom
        if (texture.current?.zoom !== zoom || texture.current.ratio !== ratio) {
          // Resolve the theme only when rebuilding the tile, outside pointer/pan frames.
          const stroke = `hsl(${getComputedStyle(stage.container()).getPropertyValue('--heroui-divider')} / 0.5)`
          const tile = document.createElement('canvas')
          tile.width = tile.height = Math.ceil(CELL_SIZE * zoom * ratio)
          const drawing = tile.getContext('2d')
          let pattern: CanvasPattern | null = null
          if (drawing) {
            drawing.strokeStyle = stroke
            drawing.lineWidth = tile.width / (CELL_SIZE * zoom)
            drawing.strokeRect(0, 0, tile.width, tile.height)
            pattern = context.createPattern(tile, 'repeat')
            // Integer bitmap sizes must still repeat at exactly CELL_SIZE, including fractional zooms.
            pattern?.setTransform(new DOMMatrix().scale(CELL_SIZE / tile.width))
          }
          texture.current = { zoom, ratio, stroke, pattern }
        }
        if (texture.current.pattern) {
          context.setAttr('fillStyle', texture.current.pattern)
          context.fillRect(left, top, right - left, bottom - top)
          return
        }
        // Preserve the grid if this browser cannot allocate the small tile/pattern.
        context.beginPath()
        for (let x = Math.floor(left / CELL_SIZE) * CELL_SIZE; x <= right; x += CELL_SIZE) {
          context.moveTo(x, top)
          context.lineTo(x, bottom)
        }
        for (let y = Math.floor(top / CELL_SIZE) * CELL_SIZE; y <= bottom; y += CELL_SIZE) {
          context.moveTo(left, y)
          context.lineTo(right, y)
        }
        context.setAttr('strokeStyle', texture.current.stroke)
        context.setAttr('lineWidth', 1 / zoom)
        context.stroke()
      }}
    />
  )
}
