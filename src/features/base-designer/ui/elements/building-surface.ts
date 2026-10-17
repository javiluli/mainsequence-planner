import { MAX_ZOOM } from '../../lib/camera'

/** The Refinery's existing radius in world pixels, shared by every machine footprint. */
export const BUILDING_RADIUS = 4.8
export const categoryColors = { Buildings: '#c99a59', Storage: '#91a8cc', Power: '#d2bc6b' } as const

const surfaces = new Map<string, HTMLCanvasElement>()

/** One reusable body bitmap per footprint keeps corners and strokes constant without adding draw calls per machine. */
export function buildingSurface(pixels: number): HTMLCanvasElement | null {
  const scale = MAX_ZOOM * window.devicePixelRatio,
    key = pixels + ':' + scale,
    cached = surfaces.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.ceil(pixels * scale)
  const context = canvas.getContext('2d')
  if (!context) return null
  context.scale(scale, scale)
  context.beginPath()
  context.roundRect(0.5, 0.5, pixels - 1, pixels - 1, BUILDING_RADIUS)
  context.fillStyle = '#7c8f9a'
  context.fill()
  context.strokeStyle = '#485f6b'
  context.lineWidth = 1
  context.stroke()
  context.beginPath()
  context.strokeStyle = '#536a76'
  context.lineWidth = 1.2
  for (const y of [11, 14.5]) {
    context.moveTo(pixels - 21, y)
    context.lineTo(pixels - 10, y)
  }
  context.stroke()
  surfaces.set(key, canvas)
  return canvas
}
