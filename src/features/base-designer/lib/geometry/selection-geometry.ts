import { PLACEABLES } from '../../model/catalog'
import type { WorldPlacement } from '../layout/world-layout'

/**
 * Select footprints intersecting a world-cell rectangle; right/bottom are exclusive cell boundaries.
 * Touching any route cell expands to its complete identity across modules, including buried cells.
 * Node selection and pointer capture are separate; preserve source order for stable clipboard/removal inputs.
 */
export function selectionAreaIds(
  pieces: readonly WorldPlacement[],
  { left, right, top, bottom }: { left: number; right: number; top: number; bottom: number },
): string[] {
  const touched = pieces.filter((piece) => {
    const footprint = PLACEABLES[piece.type]
    return piece.x < right && piece.x + footprint.width > left && piece.y < bottom && piece.y + footprint.height > top
  })
  const routes = new Set(touched.flatMap((piece) => (piece.routeId ? [piece.routeId] : [])))
  return pieces.filter((piece) => touched.includes(piece) || (piece.routeId && routes.has(piece.routeId))).map((piece) => piece.id)
}
