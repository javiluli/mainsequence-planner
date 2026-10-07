import { clamp, getPointerRadius, getPointInfluence, getSegmentInfluence, getCenterLinkVisibility, getVisualNodeRadius } from '../lib/math'
import { rgba } from '../lib/palette'
import { drawSignal } from './signal'
import type { NetworkRenderOptions } from './render.types'

export const drawLinks = ({
  context,
  engine,
  animation,
  width,
  height,
  nodeRadius,
  pointer,
  hoveredUid,
  palette,
}: NetworkRenderOptions) => {
  const pointerRadius = getPointerRadius(width, height)
  const linkRadius = engine.getLinkRadius()
  context.lineCap = 'round'
  for (const link of engine.getLinks()) {
    if (link.alpha < 0.01) {
      continue
    }
    const source = engine.getNode(link.sourceUid)
    const target = engine.getNode(link.targetUid)
    if (!source || !target) {
      continue
    }
    const margin = nodeRadius * 3
    if (
      Math.max(source.x, target.x) < -margin ||
      Math.min(source.x, target.x) > width + margin ||
      Math.max(source.y, target.y) < -margin ||
      Math.min(source.y, target.y) > height + margin
    )
      continue
    const dx = target.x - source.x
    const dy = target.y - source.y
    const centerDistance = Math.max(Math.hypot(dx, dy), 0.001)
    const directionX = dx / centerDistance
    const directionY = dy / centerDistance
    const sourceRadius = getVisualNodeRadius(
      source,
      nodeRadius,
      getPointInfluence(source, pointer, pointerRadius),
      hoveredUid === source.uid,
    )
    const targetRadius = getVisualNodeRadius(
      target,
      nodeRadius,
      getPointInfluence(target, pointer, pointerRadius),
      hoveredUid === target.uid,
    )
    const startX = source.x + directionX * sourceRadius
    const startY = source.y + directionY * sourceRadius
    const endX = target.x - directionX * targetRadius
    const endY = target.y - directionY * targetRadius
    const sourcePoint = source
    const targetPoint = target
    const proximity = 1 - clamp(centerDistance / linkRadius, 0, 1)
    const pointerInfluence = getSegmentInfluence(sourcePoint, targetPoint, pointer, pointerRadius)
    const hovered = hoveredUid === source.uid || hoveredUid === target.uid
    const centerVisibility = getCenterLinkVisibility(sourcePoint, targetPoint, width, height)
    const combinedAlpha = link.alpha * source.alpha * target.alpha

    const lineAlpha = combinedAlpha * centerVisibility * (0.065 + proximity * 0.14 + pointerInfluence * 0.1 + (hovered ? 0.16 : 0))
    const lineWidth = 0.95 + proximity * 0.9 + pointerInfluence * 0.36 + (hovered ? 0.38 : 0)
    context.beginPath()
    context.moveTo(source.x, source.y)
    context.lineTo(target.x, target.y)
    context.strokeStyle = hovered ? rgba(palette.primary, lineAlpha * 1.3) : rgba(palette.secondary, lineAlpha)
    context.lineWidth = lineWidth
    context.stroke()
    const signal = animation.getSignal(link.id)
    if (!signal || combinedAlpha < 0.12 || centerDistance <= sourceRadius + targetRadius) continue
    drawSignal({
      context,
      startX,
      startY,
      endX,
      endY,
      proximity,
      pointerInfluence,
      hovered,
      progress: signal.progress,
      alpha: combinedAlpha * centerVisibility,
      color: palette.primary,
    })
  }
}
