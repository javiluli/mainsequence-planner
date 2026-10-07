import { items } from '@/shared/data'
import { MAX_DEVICE_PIXEL_RATIO, MAX_NODE_RADIUS, MIN_NODE_RADIUS } from '../network.config'
import { NetworkEngine } from '../simulation/network-engine'
import { NetworkAnimation } from '../animation/network-animation'
import { clamp, isNodeVisible } from '../lib/math'
import { readNetworkPalette } from '../lib/palette'
import { renderNetwork } from '../rendering/network-renderer'
import { TaperedArcCache } from '../rendering/arc-cache'
import type { NetworkNode, Point } from '../network.types'
import { ItemImageCache } from './item-image-cache'
import { observeNetworkSurface } from './observe-surface'

export type NetworkController = {
  setReducedMotion: (reduced: boolean) => void
  focus: (active: boolean) => NetworkNode | null
  navigate: (key: string) => NetworkNode | null
  pointer: (point: Point | null) => void
  hitTest: (point: Point) => NetworkNode | null
  selected: () => NetworkNode | null
}

type RuntimeOptions = { container: HTMLDivElement; canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }

/** One mount owns one engine, active clock, RAF, icon cache and bounded effect cache. */
export const createNetworkRuntime = ({ container, canvas, context }: RuntimeOptions) => {
  const engine = new NetworkEngine(items)
  const animation = new NetworkAnimation()
  const arcCache = new TaperedArcCache()
  let palette = readNetworkPalette(container)
  let viewport = { width: 0, height: 0 }
  let nodeRadius = MIN_NODE_RADIUS
  let pointer: Point | null = null
  let highlightedUid: number | null = null
  let keyboardFocus = false
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let visible = true
  let disposed = false
  let frame = 0
  let previousTime: number | null = null
  let simulationTime = 0
  let dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)

  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    previousTime = null
  }

  const invalidate = () => {
    if (!disposed && !frame && !document.hidden && visible && viewport.width > 0 && viewport.height > 0) {
      frame = requestAnimationFrame(draw)
    }
  }

  const images = new ItemImageCache(invalidate)

  const draw = (now: number) => {
    frame = 0
    if (disposed || document.hidden || !visible || viewport.width <= 0 || viewport.height <= 0) {
      previousTime = null
      return
    }
    const moving = !reduced && !keyboardFocus
    if (moving) {
      const delta = previousTime === null ? 0 : clamp((now - previousTime) / 1000, 0, 0.04)
      simulationTime += delta
      engine.step(delta, simulationTime)
      animation.step(delta, engine)
      previousTime = now
    } else {
      previousTime = null
    }

    if (!keyboardFocus) {
      highlightedUid = pointer ? (engine.hitTest(pointer, nodeRadius)?.uid ?? null) : null
      const cursor = highlightedUid === null ? 'default' : 'pointer'
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor
    }

    // Resize the backing store immediately before drawing, never leave a cleared canvas waiting for another frame.
    const physicalWidth = Math.max(1, Math.round(viewport.width * dpr))
    const physicalHeight = Math.max(1, Math.round(viewport.height * dpr))
    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth
      canvas.height = physicalHeight
    }
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderNetwork({
      context,
      engine,
      animation,
      arcCache,
      ...viewport,
      nodeRadius,
      pointer,
      hoveredUid: highlightedUid,
      palette,
      getImage: images.get,
    })
    if (moving) invalidate()
  }

  const applySize = (width: number, height: number) => {
    const next = { width: Math.round(width), height: Math.round(height) }
    if (next.width === viewport.width && next.height === viewport.height) return
    viewport = next
    if (next.width <= 0 || next.height <= 0) {
      stop()
      return
    }
    nodeRadius = clamp(Math.min(next.width, next.height) / 22, MIN_NODE_RADIUS, MAX_NODE_RADIUS)
    engine.setViewport(next.width, next.height, nodeRadius)
    if (reduced || keyboardFocus) engine.settle()
    invalidate()
  }

  const unobserve = observeNetworkSurface({
    container,
    onSize: applySize,
    onVisibility(nextVisible) {
      visible = nextVisible
      stop()
      if (visible) invalidate()
    },
    onDocumentVisibility() {
      stop()
      if (!document.hidden) invalidate()
    },
    onTheme() {
      palette = readNetworkPalette(container)
      invalidate()
    },
    onDpr(nextDpr) {
      dpr = nextDpr
      invalidate()
    },
  })

  const keyboardNodes = () => engine.getNodes().filter((node) => !node.retiring && isNodeVisible(node, viewport.width, viewport.height, 0))
  const controller: NetworkController = {
    setReducedMotion(nextReduced) {
      if (reduced === nextReduced) return
      reduced = nextReduced
      stop()
      if (reduced) {
        animation.clear()
        engine.settle()
      }
      invalidate()
    },
    focus(active) {
      keyboardFocus = active
      pointer = null
      if (active) engine.settle()
      highlightedUid = active ? (keyboardNodes()[0]?.uid ?? null) : null
      stop()
      invalidate()
      return highlightedUid === null ? null : (engine.getNode(highlightedUid) ?? null)
    },
    navigate(key) {
      if (!keyboardFocus) keyboardFocus = true
      const candidates = keyboardNodes()
      const currentIndex = candidates.findIndex((node) => node.uid === highlightedUid)
      const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1
      const nextIndex =
        candidates.length === 0
          ? -1
          : key === 'Home'
            ? 0
            : key === 'End'
              ? candidates.length - 1
              : (currentIndex + step + candidates.length) % candidates.length
      const selected = candidates[nextIndex] ?? null
      highlightedUid = selected?.uid ?? null
      pointer = null
      stop()
      invalidate()
      return selected
    },
    pointer(point) {
      pointer = point
      invalidate()
    },
    hitTest: (point) => engine.hitTest(point, nodeRadius),
    selected: () => (highlightedUid === null ? null : (engine.getNode(highlightedUid) ?? null)),
  }

  return {
    controller,
    dispose() {
      disposed = true
      stop()
      unobserve()
      images.clear()
      animation.clear()
      arcCache.clear()
    },
  }
}
