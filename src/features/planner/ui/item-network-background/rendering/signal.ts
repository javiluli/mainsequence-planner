import { SIGNAL_TRAIL_LENGTH, SIGNAL_TRAIL_MAX_PIXELS } from '../network.config'
import { getSignalAlpha, getSignalTravelProgress } from '../animation/network-animation'
import { lerp } from '../lib/math'
import { rgba } from '../lib/palette'
import type { RGB } from '../network.types'

type SignalRenderOptions = {
  context: CanvasRenderingContext2D
  startX: number
  startY: number
  endX: number
  endY: number
  proximity: number
  pointerInfluence: number
  hovered: boolean
  progress: number
  alpha: number
  color: RGB
}

/** A short tapered wake, not a particle emitter: no history buffers, timers or expensive blur. */
export const drawSignal = ({
  context,
  startX,
  startY,
  endX,
  endY,
  proximity,
  pointerInfluence,
  hovered,
  progress,
  alpha,
  color,
}: SignalRenderOptions) => {
  const travel = getSignalTravelProgress(progress)
  const intensity = alpha * getSignalAlpha(progress)
  const x = lerp(startX, endX, travel)
  const y = lerp(startY, endY, travel)
  const radius = 1.65 + proximity * 0.9 + pointerInfluence * 0.55 + (hovered ? 0.3 : 0)
  const dx = endX - startX
  const dy = endY - startY
  const distance = Math.hypot(dx, dy)
  const pastTravel = getSignalTravelProgress(Math.max(0, progress - SIGNAL_TRAIL_LENGTH))
  const length = Math.min(SIGNAL_TRAIL_MAX_PIXELS, distance * (travel - pastTravel))

  if (distance > 0.001 && length > 0.1) {
    const directionX = dx / distance
    const directionY = dy / distance
    const normalX = -directionY
    const normalY = directionX
    const tailX = x - directionX * length
    const tailY = y - directionY * length
    const width = radius * 0.78
    const middleX = lerp(tailX, x, 0.65)
    const middleY = lerp(tailY, y, 0.65)
    const gradient = context.createLinearGradient(tailX, tailY, x, y)
    gradient.addColorStop(0, rgba(color, 0))
    gradient.addColorStop(0.55, rgba(color, intensity * 0.075))
    gradient.addColorStop(1, rgba(color, intensity * 0.28))
    context.beginPath()
    context.moveTo(tailX, tailY)
    context.quadraticCurveTo(middleX + normalX * width * 0.25, middleY + normalY * width * 0.25, x + normalX * width, y + normalY * width)
    context.lineTo(x - normalX * width, y - normalY * width)
    context.quadraticCurveTo(middleX - normalX * width * 0.25, middleY - normalY * width * 0.25, tailX, tailY)
    context.closePath()
    context.fillStyle = gradient
    context.fill()
    context.beginPath()
    context.moveTo(tailX, tailY)
    context.lineTo(x, y)
    context.strokeStyle = gradient
    context.lineWidth = 0.75
    context.stroke()
  }

  context.beginPath()
  context.arc(x, y, radius * 3, 0, Math.PI * 2)
  context.fillStyle = rgba(color, intensity * 0.028)
  context.fill()
  context.beginPath()
  context.arc(x, y, radius * 1.75, 0, Math.PI * 2)
  context.fillStyle = rgba(color, intensity * (0.1 + proximity * 0.05))
  context.fill()
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fillStyle = rgba(color, intensity * (0.72 + proximity * 0.08))
  context.fill()
}
