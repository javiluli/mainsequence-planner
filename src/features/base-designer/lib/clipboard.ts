import { PLACEABLES } from '../model/catalog'
import type { BasePlacement } from './placement'

/** Center the entire copied footprint on one snapped world cell, preserving relative positions. */
export function clipboardPlacementsAt(source: readonly BasePlacement[], cursor: { x: number; y: number }): BasePlacement[] {
  if (!source.length) return []
  const left = Math.min(...source.map((piece) => piece.x))
  const top = Math.min(...source.map((piece) => piece.y))
  const right = Math.max(...source.map((piece) => piece.x + PLACEABLES[piece.type].width))
  const bottom = Math.max(...source.map((piece) => piece.y + PLACEABLES[piece.type].height))
  const dx = cursor.x - left - Math.floor((right - left - 1) / 2)
  const dy = cursor.y - top - Math.floor((bottom - top - 1) / 2)
  return source.map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy }))
}
