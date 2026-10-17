import { useEffect, useState } from 'react'
import { MAX_ZOOM } from '../../lib/camera'
import stationUrl from '../elements/station.svg'
import corridorUrl from '../elements/corridor.svg'
import droneUrl from '../elements/drone-station.svg'

/** Rasterize a shared square sprite at maximum zoom/DPR; retain the SVG if canvas allocation fails. */
function rasterizeArtwork(image: HTMLImageElement, worldSize: number): CanvasImageSource {
  const bitmap = document.createElement('canvas')
  bitmap.width = bitmap.height = Math.ceil(worldSize * MAX_ZOOM * window.devicePixelRatio)
  const context = bitmap.getContext('2d')
  if (!context) return image
  context.drawImage(image, 0, 0, bitmap.width, bitmap.height)
  return bitmap
}

/** Load editor artwork independently from pointer/camera ownership and detach callbacks on teardown. */
export function useCanvasArtwork() {
  const [image, setImage] = useState<CanvasImageSource | null>(null),
    [corridorImage, setCorridorImage] = useState<HTMLImageElement | null>(null),
    [droneImage, setDroneImage] = useState<CanvasImageSource | null>(null),
    [imageFailed, setImageFailed] = useState(false)
  useEffect(() => {
    const station = new window.Image(),
      corridor = new window.Image(),
      drone = new window.Image()
    station.onload = () => setImage(rasterizeArtwork(station, station.naturalWidth))
    corridor.onload = () => setCorridorImage(corridor)
    drone.onload = () => setDroneImage(rasterizeArtwork(drone, drone.naturalWidth))
    for (const artwork of [station, corridor, drone]) artwork.onerror = () => setImageFailed(true)
    station.src = stationUrl
    corridor.src = corridorUrl
    drone.src = droneUrl
    return () => {
      for (const artwork of [station, corridor, drone]) {
        artwork.onload = null
        artwork.onerror = null
      }
    }
  }, [])
  return { image, corridorImage, droneImage, imageFailed }
}
