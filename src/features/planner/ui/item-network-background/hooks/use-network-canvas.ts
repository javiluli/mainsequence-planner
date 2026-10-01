import { useReducedMotion } from 'framer-motion'
import { useLayoutEffect, useRef } from 'react'
import { createNetworkRuntime, type NetworkController } from '../runtime/network-runtime'

/** React owns mount/cleanup and preference changes, never the per-frame simulation. */
export const useNetworkCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<NetworkController | null>(null)
  const reducedMotion = useReducedMotion() ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useLayoutEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!container || !canvas || !context) return
    const runtime = createNetworkRuntime({ container, canvas, context })
    controllerRef.current = runtime.controller
    return () => {
      controllerRef.current = null
      runtime.dispose()
    }
  }, [])

  useLayoutEffect(() => {
    controllerRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  return { containerRef, canvasRef, controllerRef }
}
