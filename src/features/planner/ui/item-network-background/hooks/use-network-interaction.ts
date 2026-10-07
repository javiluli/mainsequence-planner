import { useLayoutEffect, useRef, useState, type CanvasHTMLAttributes, type PointerEvent, type RefObject } from 'react'
import { distanceSquared } from '../lib/math'
import type { Point } from '../network.types'
import type { NetworkController } from '../runtime/network-runtime'

const pointerPosition = (event: PointerEvent<HTMLCanvasElement>): Point => {
  const rect = event.currentTarget.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

type InteractionOptions = { controllerRef: RefObject<NetworkController | null>; onSelect: (itemId: string) => void }

export const useNetworkInteraction = ({ controllerRef, onSelect }: InteractionOptions) => {
  const pressRef = useRef<{ id: number; point: Point } | null>(null)
  const [activeName, setActiveName] = useState('')
  useLayoutEffect(
    () => () => {
      pressRef.current = null
    },
    [],
  )
  const cancelPointer = () => {
    pressRef.current = null
    controllerRef.current?.pointer(null)
  }

  const canvasEvents: CanvasHTMLAttributes<HTMLCanvasElement> = {
    onKeyDown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const node = controllerRef.current?.navigate(event.key)
        setActiveName(node?.itemName ?? '')
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const node = controllerRef.current?.selected()
        if (node) onSelect(node.itemId)
      }
    },
    onFocus(event) {
      if (event.currentTarget.matches(':focus-visible')) {
        const node = controllerRef.current?.focus(true)
        setActiveName(node?.itemName ?? '')
      }
    },
    onBlur() {
      controllerRef.current?.focus(false)
      setActiveName('')
    },
    onPointerMove: (event) => controllerRef.current?.pointer(pointerPosition(event)),
    onPointerLeave: cancelPointer,
    onPointerCancel: cancelPointer,
    onPointerDown(event) {
      if (event.button !== 0 || !event.isPrimary) return
      controllerRef.current?.focus(false)
      setActiveName('')
      pressRef.current = { id: event.pointerId, point: { x: event.clientX, y: event.clientY } }
    },
    onPointerUp(event) {
      const press = pressRef.current
      pressRef.current = null
      if (!press || press.id !== event.pointerId || distanceSquared(press.point, { x: event.clientX, y: event.clientY }) > 64) return
      const node = controllerRef.current?.hitTest(pointerPosition(event))
      if (node) onSelect(node.itemId)
    },
  }

  return { activeName, canvasEvents }
}
