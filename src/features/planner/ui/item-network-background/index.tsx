import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { usePlannerTarget } from '@/features/planner/hooks/use-planner-target'
import { items } from '@/shared/data'
import { getIconSource } from '@/shared/ui/asset-image/icon-source'

import { DEFAULT_NETWORK_PALETTE, MAX_DEVICE_PIXEL_RATIO, MAX_NODE_RADIUS, MIN_NODE_RADIUS } from './network.config'

import { NetworkEngine } from './network-engine'

import { readNetworkPalette, renderNetwork } from './network-renderer'

import type { NetworkPalette, NetworkViewport, Point } from './network.types'

const INITIAL_VIEWPORT: NetworkViewport = {
  width: 0,
  height: 0,
}

const getResponsiveNodeRadius = (width: number, height: number) =>
  Math.min(
    MAX_NODE_RADIUS,

    Math.max(
      MIN_NODE_RADIUS,

      Math.min(width, height) / 22,
    ),
  )

const getPointerPosition = (clientX: number, clientY: number, element: HTMLElement): Point => {
  const rect = element.getBoundingClientRect()

  return {
    x: clientX - rect.left,

    y: clientY - rect.top,
  }
}

export function ItemNetworkBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  /**
   * Una única instancia durante toda la vida del componente.
   */
  const [engine] = useState(() => new NetworkEngine(items))

  const viewportRef = useRef<NetworkViewport>(INITIAL_VIEWPORT)

  const nodeRadiusRef = useRef(MIN_NODE_RADIUS)

  const pointerRef = useRef<Point | null>(null)

  const hoveredNodeUidRef = useRef<number | null>(null)

  const paletteRef = useRef<NetworkPalette>(DEFAULT_NETWORK_PALETTE)

  const reducedMotionRef = useRef(false)

  const imagesRef = useRef(new Map<string, HTMLImageElement>())

  const { selectTargetItem } = usePlannerTarget()

  const getItemImage = useCallback((itemId: string) => {
    const existing = imagesRef.current.get(itemId)

    if (existing) {
      return existing
    }

    const source = getIconSource('items', itemId)

    if (!source) {
      return null
    }

    const image = new Image()

    image.decoding = 'async'

    image.src = source

    imagesRef.current.set(itemId, image)

    return image
  }, [])

  /**
   * =============================================================
   * VIEWPORT
   * =============================================================
   */
  useLayoutEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    let retryFrame = 0

    const applyViewportSize = (width: number, height: number) => {
      const roundedWidth = Math.round(width)

      const roundedHeight = Math.round(height)

      if (roundedWidth <= 0 || roundedHeight <= 0) {
        return false
      }

      const previous = viewportRef.current

      if (previous.width === roundedWidth && previous.height === roundedHeight) {
        return true
      }

      viewportRef.current = {
        width: roundedWidth,

        height: roundedHeight,
      }

      const radius = getResponsiveNodeRadius(roundedWidth, roundedHeight)

      nodeRadiusRef.current = radius

      engine.setViewport(roundedWidth, roundedHeight, radius)

      return true
    }

    /**
     * El componente puede montarse antes de que su padre tenga
     * dimensiones definitivas.
     */
    const measureInitialSize = () => {
      const rect = container.getBoundingClientRect()

      const measured = applyViewportSize(rect.width, rect.height)

      if (!measured) {
        retryFrame = requestAnimationFrame(measureInitialSize)
      }
    }

    measureInitialSize()

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return
      }

      applyViewportSize(
        entry.contentRect.width,

        entry.contentRect.height,
      )
    })

    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(retryFrame)

      resizeObserver.disconnect()
    }
  }, [engine])

  /**
   * =============================================================
   * CANVAS / LOOP
   * =============================================================
   */
  useEffect(() => {
    const container = containerRef.current

    const canvas = canvasRef.current

    if (!container || !canvas) {
      return
    }

    const context = canvas.getContext('2d', {
      alpha: true,
    })

    if (!context) {
      return
    }

    paletteRef.current = readNetworkPalette(container)

    /**
     * Reduced motion.
     */
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    reducedMotionRef.current = motionQuery.matches

    const handleMotionChange = () => {
      reducedMotionRef.current = motionQuery.matches
    }

    motionQuery.addEventListener('change', handleMotionChange)

    /**
     * Actualiza automáticamente la paleta si cambia HeroUI.
     */
    let paletteFrame = 0

    const updatePalette = () => {
      cancelAnimationFrame(paletteFrame)

      paletteFrame = requestAnimationFrame(() => {
        paletteRef.current = readNetworkPalette(container)
      })
    }

    const themeObserver = new MutationObserver(updatePalette)

    themeObserver.observe(document.documentElement, {
      attributes: true,

      attributeFilter: ['class', 'style'],
    })

    let animationFrame = 0

    let previousTime = performance.now()

    const renderFrame = (now: number) => {
      const viewport = viewportRef.current

      if (viewport.width <= 0 || viewport.height <= 0) {
        previousTime = now

        animationFrame = requestAnimationFrame(renderFrame)

        return
      }

      const deltaSeconds = (now - previousTime) / 1000

      previousTime = now

      /**
       * Evita grandes saltos después de volver a una pestaña.
       */
      if (document.hidden) {
        animationFrame = requestAnimationFrame(renderFrame)

        return
      }

      const timeSeconds = now / 1000

      engine.step(deltaSeconds, timeSeconds, reducedMotionRef.current)

      const dpr = Math.min(
        window.devicePixelRatio || 1,

        MAX_DEVICE_PIXEL_RATIO,
      )

      const physicalWidth = Math.max(
        1,

        Math.round(viewport.width * dpr),
      )

      const physicalHeight = Math.max(
        1,

        Math.round(viewport.height * dpr),
      )

      /**
       * El backing store sólo cambia justo antes del render.
       *
       * Así evitamos el flash transparente durante resize.
       */
      if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
        canvas.width = physicalWidth

        canvas.height = physicalHeight
      }

      context.setTransform(1, 0, 0, 1, 0, 0)

      context.clearRect(0, 0, canvas.width, canvas.height)

      /**
       * Desde aquí trabajamos en CSS pixels.
       */
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      context.imageSmoothingEnabled = true

      renderNetwork({
        context,
        engine,

        width: viewport.width,

        height: viewport.height,

        time: timeSeconds,

        nodeRadius: nodeRadiusRef.current,

        pointer: pointerRef.current,

        hoveredUid: hoveredNodeUidRef.current,

        palette: paletteRef.current,

        reducedMotion: reducedMotionRef.current,

        getImage: getItemImage,
      })

      animationFrame = requestAnimationFrame(renderFrame)
    }

    animationFrame = requestAnimationFrame(renderFrame)

    return () => {
      cancelAnimationFrame(animationFrame)

      cancelAnimationFrame(paletteFrame)

      themeObserver.disconnect()

      motionQuery.removeEventListener('change', handleMotionChange)
    }
  }, [engine, getItemImage])

  /**
   * =============================================================
   * POINTER
   * =============================================================
   *
   * El cursor modifica únicamente el aspecto visual.
   * Nunca empuja ni atrae nodos.
   */
  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current

      if (!canvas) {
        return
      }

      const point = getPointerPosition(event.clientX, event.clientY, canvas)

      pointerRef.current = point

      const hovered = engine.hitTest(point, nodeRadiusRef.current)

      hoveredNodeUidRef.current = hovered?.uid ?? null

      canvas.style.cursor = hovered ? 'pointer' : 'default'
    },
    [engine],
  )

  const handlePointerLeave = useCallback(() => {
    pointerRef.current = null

    hoveredNodeUidRef.current = null

    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default'
    }
  }, [])

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current

      if (!canvas) {
        return
      }

      const point = getPointerPosition(event.clientX, event.clientY, canvas)

      const node = engine.hitTest(point, nodeRadiusRef.current)

      if (!node) {
        return
      }

      selectTargetItem(node.itemId)
    },
    [engine, selectTargetItem],
  )

  return (
    <div ref={containerRef} className="planner-network absolute inset-0 z-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      />
    </div>
  )
}
