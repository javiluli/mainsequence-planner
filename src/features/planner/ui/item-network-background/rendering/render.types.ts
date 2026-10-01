import type { NetworkEngine } from '../simulation/network-engine'
import type { NetworkAnimation } from '../animation/network-animation'
import type { TaperedArcCache } from './arc-cache'
import type { NetworkPalette, Point } from '../network.types'

export type NetworkRenderOptions = {
  context: CanvasRenderingContext2D
  engine: NetworkEngine
  animation: NetworkAnimation
  arcCache: TaperedArcCache
  width: number
  height: number
  nodeRadius: number
  pointer: Point | null
  hoveredUid: number | null
  palette: NetworkPalette
  getImage: (itemId: string) => HTMLImageElement | null
}
