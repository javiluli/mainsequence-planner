import {
  IMPACT_BEAD_ALPHA,
  IMPACT_BEAD_RADIUS,
  IMPACT_CORONA_ALPHA,
  IMPACT_CORONA_ARC_SPAN,
  IMPACT_CORONA_BLUR,
  IMPACT_CORONA_EXPANSION,
  IMPACT_CORONA_FALLOFF,
  IMPACT_GLINT_LENGTH,
  IMPACT_LIMB_ALPHA,
  IMPACT_LIMB_ARC_SPAN,
  IMPACT_LIMB_BLUR,
  IMPACT_LIMB_FALLOFF,
} from '../network.config'
import { getCinematicImpactEnvelope } from '../animation/impact-envelope'
import { smootherstep, getCenterLinkVisibility, getPointerRadius, getPointInfluence, getVisualNodeRadius, isNodeVisible } from '../lib/math'
import { getImpactColors, rgba } from '../lib/palette'
import type { NetworkRenderOptions } from './render.types'

type ImpactRenderOptions = Omit<NetworkRenderOptions, 'getImage'>

export const drawBackImpacts = ({
  context,
  engine,
  animation,
  arcCache,
  width,
  height,
  nodeRadius,
  pointer,
  hoveredUid,
  palette,
}: ImpactRenderOptions) => {
  const pointerRadius = getPointerRadius(width, height)
  const colors = getImpactColors(palette)
  for (const impact of animation.getImpacts()) {
    const target = engine.getNode(impact.targetUid)
    if (!target || !isNodeVisible(target, width, height, nodeRadius * 3)) continue
    const { progress } = impact
    const baseAlpha = impact.strength * target.alpha * getCenterLinkVisibility(target, target, width, height)
    const envelope = getCinematicImpactEnvelope(progress)
    const intensity = baseAlpha * envelope.corona
    if (intensity <= 0.001) {
      continue
    }
    const targetRadius = getVisualNodeRadius(
      target,
      nodeRadius,
      getPointInfluence(target, pointer, pointerRadius),
      hoveredUid === target.uid,
    )
    const incomingAngle = impact.angle
    const expansionProgress = smootherstep(progress)
    const coronaRadius = targetRadius * (1.035 + expansionProgress * IMPACT_CORONA_EXPANSION)
    const warmCorona = colors.corona
    context.save()
    context.globalCompositeOperation = 'lighter'
    context.shadowColor = rgba(warmCorona, intensity * IMPACT_CORONA_ALPHA)
    context.shadowBlur = IMPACT_CORONA_BLUR
    arcCache.draw({
      context,
      x: target.x,
      y: target.y,
      radius: coronaRadius,
      centerAngle: incomingAngle,
      span: IMPACT_CORONA_ARC_SPAN,
      segments: 34,
      lineWidth: 2.15 + intensity * 0.8,
      color: warmCorona,
      peakAlpha: intensity * IMPACT_CORONA_ALPHA,
      falloff: IMPACT_CORONA_FALLOFF,
      shadowColor: warmCorona,
      shadowAlpha: intensity * IMPACT_CORONA_ALPHA,
      shadowBlur: IMPACT_CORONA_BLUR,
    })
    context.shadowBlur = IMPACT_CORONA_BLUR * 1.45
    arcCache.draw({
      context,
      x: target.x,
      y: target.y,
      radius: coronaRadius * 1.06,
      centerAngle: incomingAngle,
      span: IMPACT_CORONA_ARC_SPAN * 1.08,
      segments: 36,
      lineWidth: 1.5,
      color: warmCorona,
      peakAlpha: intensity * IMPACT_CORONA_ALPHA * 0.22,
      falloff: IMPACT_CORONA_FALLOFF,
      shadowColor: warmCorona,
      shadowAlpha: intensity * IMPACT_CORONA_ALPHA,
      shadowBlur: IMPACT_CORONA_BLUR * 1.45,
    })
    context.restore()
  }
}

export const drawFrontImpacts = ({
  context,
  engine,
  animation,
  arcCache,
  width,
  height,
  nodeRadius,
  pointer,
  hoveredUid,
  palette,
}: ImpactRenderOptions) => {
  const pointerRadius = getPointerRadius(width, height)
  const colors = getImpactColors(palette)
  for (const impact of animation.getImpacts()) {
    const target = engine.getNode(impact.targetUid)
    if (!target || !isNodeVisible(target, width, height, nodeRadius * 3)) continue
    const { progress } = impact
    const baseAlpha = impact.strength * target.alpha * getCenterLinkVisibility(target, target, width, height)
    const envelope = getCinematicImpactEnvelope(progress)
    const limbIntensity = baseAlpha * envelope.limb
    const beadIntensity = baseAlpha * envelope.bead
    const glintIntensity = baseAlpha * envelope.glint
    if (limbIntensity <= 0.001 && beadIntensity <= 0.001) {
      continue
    }
    const targetRadius = getVisualNodeRadius(
      target,
      nodeRadius,
      getPointInfluence(target, pointer, pointerRadius),
      hoveredUid === target.uid,
    )
    const incomingAngle = impact.angle
    const directionX = Math.cos(incomingAngle)
    const directionY = Math.sin(incomingAngle)
    const tangentX = -directionY
    const tangentY = directionX
    const contactX = target.x + directionX * targetRadius
    const contactY = target.y + directionY * targetRadius
    const warmColor = colors.warm
    const hotColor = colors.hot
    context.save()
    context.globalCompositeOperation = 'lighter'
    context.shadowColor = rgba(warmColor, limbIntensity * IMPACT_LIMB_ALPHA)
    context.shadowBlur = IMPACT_LIMB_BLUR
    arcCache.draw({
      context,
      x: target.x,
      y: target.y,
      radius: targetRadius * (1.008 + smootherstep(progress) * 0.014),
      centerAngle: incomingAngle,
      span: IMPACT_LIMB_ARC_SPAN,
      segments: 34,
      lineWidth: 1.12 + limbIntensity * 0.72,
      color: warmColor,
      peakAlpha: limbIntensity * IMPACT_LIMB_ALPHA,
      falloff: IMPACT_LIMB_FALLOFF,
      shadowColor: warmColor,
      shadowAlpha: limbIntensity * IMPACT_LIMB_ALPHA,
      shadowBlur: IMPACT_LIMB_BLUR,
    })
    if (beadIntensity > 0.002) {
      context.shadowColor = rgba(hotColor, beadIntensity * IMPACT_BEAD_ALPHA)
      context.shadowBlur = 5 + beadIntensity * 7
      context.beginPath()
      context.arc(contactX, contactY, IMPACT_BEAD_RADIUS + beadIntensity * 0.4, 0, Math.PI * 2)
      context.fillStyle = rgba(hotColor, beadIntensity * IMPACT_BEAD_ALPHA)
      context.fill()
    }
    if (glintIntensity > 0.002) {
      const glintLength = IMPACT_GLINT_LENGTH * glintIntensity
      context.shadowBlur = 3
      context.beginPath()
      context.moveTo(contactX - (tangentX * glintLength) / 2, contactY - (tangentY * glintLength) / 2)
      context.lineTo(contactX + (tangentX * glintLength) / 2, contactY + (tangentY * glintLength) / 2)
      context.strokeStyle = rgba(hotColor, glintIntensity * IMPACT_BEAD_ALPHA * 0.5)
      context.lineWidth = 0.7
      context.stroke()
    }
    arcCache.draw({
      context,
      x: target.x,
      y: target.y,
      radius: targetRadius * (1.024 + smootherstep(progress) * 0.048),
      centerAngle: incomingAngle,
      span: IMPACT_LIMB_ARC_SPAN * 0.72,
      segments: 24,
      lineWidth: 0.68,
      color: warmColor,
      peakAlpha: limbIntensity * 0.105,
      falloff: IMPACT_LIMB_FALLOFF,
      shadowColor: beadIntensity > 0.002 ? hotColor : warmColor,
      shadowAlpha: beadIntensity > 0.002 ? beadIntensity * IMPACT_BEAD_ALPHA : limbIntensity * IMPACT_LIMB_ALPHA,
      shadowBlur: glintIntensity > 0.002 ? 3 : beadIntensity > 0.002 ? 5 + beadIntensity * 7 : IMPACT_LIMB_BLUR,
    })
    context.restore()
  }
}
