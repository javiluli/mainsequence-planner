import type { Point } from '../model/scene'

/** View translation in screen pixels, with one uniform world-to-screen scale. */
export interface Camera extends Point {
  zoom: number
}

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4

/** Keeps the world point under the screen anchor stationary while changing zoom. */
export function zoomAt(camera: Camera, anchor: Point, factor: number): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor))
  return {
    x: anchor.x - ((anchor.x - camera.x) / camera.zoom) * zoom,
    y: anchor.y - ((anchor.y - camera.y) / camera.zoom) * zoom,
    zoom,
  }
}
