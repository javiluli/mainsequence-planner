import { useCallback, useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

/**
 * Owns right-drag capture, including over nodes where React Flow's nopan wrapper blocks panning.
 * Deltas and viewport translation use screen pixels; zoom must not scale the pointer delta.
 */
export function useCanvasPan({
  getViewport,
  onPan,
}: {
  getViewport: () => { x: number; y: number; zoom: number } | undefined
  onPan: (viewport: { x: number; y: number; zoom: number }) => void
}) {
  const gesture = useRef<{
    pointerId: number
    target: HTMLDivElement
    startX: number
    startY: number
    viewport: { x: number; y: number; zoom: number }
  } | null>(null)
  const moved = useRef(false)
  const finish = useCallback(() => {
    const current = gesture.current
    gesture.current = null
    if (current?.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId)
  }, [])
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || gesture.current) return false
    moved.current = false
    if (event.button !== 2) return false
    if (
      event.target instanceof Element &&
      event.target.closest('button, input, textarea, select, [contenteditable="true"], [role="button"]')
    )
      return false
    const viewport = getViewport()
    if (!viewport) return false
    gesture.current = { pointerId: event.pointerId, target: event.currentTarget, startX: event.clientX, startY: event.clientY, viewport }
    event.preventDefault()
    event.stopPropagation()
    return true
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return false
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    // Delay capture until a drag is established so a stationary right-click can still remove a route anchor.
    moved.current ||= Math.hypot(dx, dy) > 3
    if (moved.current) {
      if (!current.target.hasPointerCapture(current.pointerId)) current.target.setPointerCapture(current.pointerId)
      onPan({ ...current.viewport, x: current.viewport.x + dx, y: current.viewport.y + dy })
    }
    event.preventDefault()
    event.stopPropagation()
    return true
  }
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    // Keep the moved flag through release: the following contextmenu must not also edit the route.
    if (gesture.current?.pointerId === event.pointerId) finish()
  }
  const cancel = useCallback(() => {
    finish()
    moved.current = false
  }, [finish])
  useLayoutEffect(() => cancel, [cancel])
  const handleLostPointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId === event.pointerId) cancel()
  }
  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!moved.current) return false
    event.preventDefault()
    event.stopPropagation()
    return true
  }
  return { handlePointerDown, handlePointerMove, handlePointerUp, handleLostPointerCapture, handleContextMenu, cancel }
}
