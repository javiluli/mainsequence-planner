import { MAX_DEVICE_PIXEL_RATIO } from '../network.config'
import { rgba } from '../lib/palette'
import type { RGB } from '../network.types'

type ArcOptions = {
  context: CanvasRenderingContext2D
  x: number
  y: number
  radius: number
  centerAngle: number
  span: number
  segments: number
  lineWidth: number
  color: RGB
  peakAlpha: number
  falloff: number
  shadowColor: RGB
  shadowAlpha: number
  shadowBlur: number
}

type ArcSprite = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  radius: number
  size: number
}

const MAX_ARC_SPRITES = 64
const ALPHA_STEPS = 64

/** Rasterize the tapered arc and its shadow together; the large animation canvas only composites reusable images. */
export class TaperedArcCache {
  private readonly sprites = new Map<string, ArcSprite>()
  private readonly colorIds = new WeakMap<RGB, number>()
  private readonly mask = document.createElement('canvas')
  private readonly maskContext = this.mask.getContext('2d')
  private nextColorId = 1

  public draw(options: ArcOptions) {
    const { context, x, y, radius, centerAngle, peakAlpha } = options
    if (peakAlpha <= 0) return
    const cachedRadius = Math.max(1, Math.round(radius))
    const lineWidth = Math.round(options.lineWidth * 10) / 10
    // Round up, then compensate with globalAlpha: even the faintest tail remains continuous instead of stepping to zero.
    const alpha = Math.ceil(peakAlpha * ALPHA_STEPS) / ALPHA_STEPS
    const shadowAlpha = Math.round(options.shadowAlpha * ALPHA_STEPS) / ALPHA_STEPS
    const dpr = Math.max(0.5, Math.abs(context.getTransform().a))
    const resolution = Math.min(dpr, MAX_DEVICE_PIXEL_RATIO)
    const blur = Math.round((options.shadowBlur / dpr) * 2) / 2
    const colorId = this.getColorId(options.color)
    const shadowId = this.getColorId(options.shadowColor)
    const key = `${colorId}:${shadowId}:${cachedRadius}:${lineWidth}:${alpha}:${shadowAlpha}:${blur}:${resolution}:${options.span}:${options.segments}:${options.falloff}`
    let sprite = this.sprites.get(key)
    if (sprite) {
      this.sprites.delete(key)
      this.sprites.set(key, sprite)
    } else {
      sprite = this.paint(options, cachedRadius, lineWidth, alpha, shadowAlpha, blur, resolution)
      if (!sprite) return
      this.sprites.set(key, sprite)
    }

    const scale = radius / sprite.radius
    context.save()
    context.translate(x, y)
    context.rotate(centerAngle)
    context.scale(scale, scale)
    context.shadowBlur = 0
    context.shadowColor = 'rgba(0, 0, 0, 0)'
    context.globalAlpha *= peakAlpha / alpha
    context.drawImage(sprite.canvas, -sprite.size / 2, -sprite.size / 2, sprite.size, sprite.size)
    context.restore()
  }

  private getColorId(color: RGB) {
    let colorId = this.colorIds.get(color)
    if (colorId === undefined) {
      colorId = this.nextColorId++
      this.colorIds.set(color, colorId)
    }
    return colorId
  }

  public clear() {
    for (const sprite of this.sprites.values()) {
      sprite.canvas.width = 0
      sprite.canvas.height = 0
    }
    this.sprites.clear()
    this.mask.width = 0
    this.mask.height = 0
  }

  private paint(
    options: ArcOptions,
    radius: number,
    lineWidth: number,
    alpha: number,
    shadowAlpha: number,
    blur: number,
    resolution: number,
  ): ArcSprite | undefined {
    const maskContext = this.maskContext
    if (!maskContext) return undefined
    let sprite: ArcSprite | undefined
    if (this.sprites.size >= MAX_ARC_SPRITES) {
      const oldestKey = this.sprites.keys().next().value
      if (oldestKey !== undefined) {
        sprite = this.sprites.get(oldestKey)
        this.sprites.delete(oldestKey)
      }
    }
    if (!sprite) {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return undefined
      sprite = { canvas, context, radius, size: 0 }
    }

    const maskSize = Math.ceil((radius + lineWidth + 2) * 2)
    const maskPixels = Math.ceil(maskSize * resolution)
    if (this.mask.width !== maskPixels || this.mask.height !== maskPixels) {
      this.mask.width = maskPixels
      this.mask.height = maskPixels
    } else {
      maskContext.setTransform(1, 0, 0, 1, 0, 0)
      maskContext.clearRect(0, 0, maskPixels, maskPixels)
    }
    maskContext.setTransform(resolution, 0, 0, resolution, maskPixels / 2, maskPixels / 2)
    maskContext.globalCompositeOperation = 'lighter'
    maskContext.lineCap = 'round'
    const { span, segments, falloff, color } = options
    const halfSpan = span / 2
    const overlap = (span / segments) * 0.1
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments
      const t1 = (index + 1) / segments
      const cosine = Math.cos(Math.abs((t0 + t1) / 2 - 0.5) * Math.PI)
      const envelope = Math.pow(Math.max(0, cosine), falloff)
      if (envelope < 0.002) continue
      maskContext.beginPath()
      maskContext.arc(0, 0, radius, -halfSpan + t0 * span - overlap, -halfSpan + t1 * span + overlap)
      maskContext.strokeStyle = rgba(color, alpha * envelope)
      maskContext.lineWidth = lineWidth * (0.72 + envelope * 0.28)
      maskContext.stroke()
    }

    const pixels = Math.ceil((maskSize + blur * 6) * resolution)
    const { canvas, context: spriteContext } = sprite
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels
      canvas.height = pixels
    } else {
      spriteContext.setTransform(1, 0, 0, 1, 0, 0)
      spriteContext.clearRect(0, 0, pixels, pixels)
    }
    spriteContext.setTransform(resolution, 0, 0, resolution, pixels / 2, pixels / 2)
    spriteContext.globalCompositeOperation = 'lighter'
    spriteContext.shadowColor = rgba(options.shadowColor, shadowAlpha)
    spriteContext.shadowBlur = blur * resolution
    const maskExtent = maskPixels / resolution
    spriteContext.drawImage(this.mask, -maskExtent / 2, -maskExtent / 2, maskExtent, maskExtent)
    sprite.radius = radius
    sprite.size = pixels / resolution
    return sprite
  }
}
