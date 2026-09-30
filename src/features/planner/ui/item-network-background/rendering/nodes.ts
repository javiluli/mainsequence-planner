import { getPointerRadius, getPointInfluence, getVisualNodeRadius, isNodeVisible } from '../lib/math'
import { rgba } from '../lib/palette'
import type { NetworkRenderOptions } from './render.types'

export const drawNodes = ({ context, engine, width, height, nodeRadius, pointer, hoveredUid, palette, getImage }: NetworkRenderOptions) => {
  const pointerRadius = getPointerRadius(width, height)
  for (const node of engine.getNodes()) {
    if (!isNodeVisible(node, width, height, nodeRadius * 3)) {
      continue
    }
    const pointerInfluence = getPointInfluence(node, pointer, pointerRadius)
    const hovered = hoveredUid === node.uid
    const radius = getVisualNodeRadius(node, nodeRadius, pointerInfluence, hovered)
    const typeColor = palette[node.itemType]
    const accentColor = hovered ? palette.primary : typeColor
    const alpha = node.alpha
    context.beginPath()
    context.arc(node.x, node.y, radius * (1.24 + pointerInfluence * 0.035), 0, Math.PI * 2)
    context.fillStyle = rgba(accentColor, alpha * (0.015 + pointerInfluence * 0.04 + (hovered ? 0.05 : 0)))
    context.fill()
    context.beginPath()
    context.arc(node.x, node.y, radius * 1.095, 0, Math.PI * 2)
    context.strokeStyle = rgba(accentColor, alpha * (0.06 + pointerInfluence * 0.12 + (hovered ? 0.17 : 0)))
    context.lineWidth = 0.8 + pointerInfluence * 0.32
    context.stroke()
    context.beginPath()
    context.arc(node.x, node.y, radius, 0, Math.PI * 2)
    context.fillStyle = rgba(palette.content, alpha * 0.94)
    context.fill()
    context.beginPath()
    context.arc(node.x, node.y, radius, 0, Math.PI * 2)
    context.strokeStyle = rgba(accentColor, alpha * (hovered ? 0.76 : 0.25 + pointerInfluence * 0.17))
    context.lineWidth = hovered ? 1.75 : 1.05 + pointerInfluence * 0.28
    context.stroke()
    const image = getImage(node.itemId)
    if (image?.complete && image.naturalWidth > 0) {
      const imageSize = radius * 1.38
      context.globalAlpha = alpha * (0.85 + pointerInfluence * 0.07)
      context.drawImage(image, node.x - imageSize / 2, node.y - imageSize / 2, imageSize, imageSize)
      context.globalAlpha = 1
    }
  }
}
