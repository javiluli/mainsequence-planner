import Konva from 'konva'

/** Body washes share the actor color without tinting labels, product icons or I/O. */
export function highlightFill(color: string): string {
  const { r, g, b } = Konva.Util.getRGB(color)
  return `rgba(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)},0.4)`
}

/** Opaque track tint keeps overlapping junctions uniform while items animate in their own layer. */
export function highlightedTrack(color: string): string {
  const { r, g, b } = Konva.Util.getRGB(color)
  return `rgb(${Math.round(41 * 0.65 + r * 0.35)},${Math.round(62 * 0.65 + g * 0.35)},${Math.round(73 * 0.65 + b * 0.35)})`
}

/** Native previews retain the same wash when validity changes, without a React render per pointer event. */
export function paintHighlights(group: Konva.Group, color: string) {
  for (const outline of group.find<Konva.Shape>('.outline')) outline.stroke(color)
  for (const body of group.find<Konva.Shape>('.body-highlight')) body.fill(highlightFill(color))
  for (const track of group.find<Konva.Shape>('.track-highlight')) track.stroke(highlightedTrack(color))
  for (const junction of group.find<Konva.Shape>('.track-fill-highlight')) junction.fill(highlightedTrack(color))
  for (const rail of group.find<Konva.Shape>('.rail-fill-highlight')) rail.fill(color)
}
