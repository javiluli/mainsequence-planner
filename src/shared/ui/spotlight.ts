import type { PointerEvent } from 'react'

import './spotlight.css'

/**
 * Positions the decorative border on the nearest `spotlight-surface` without React state.
 * Attach to the surface or its header; coordinates belong to that surface, not a child icon.
 * Capability and motion preferences are read per event so changes take effect immediately.
 */
export function handleSpotlightPointerMove(event: PointerEvent<HTMLElement>) {
  if (
    event.pointerType !== 'mouse' ||
    !window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches
  ) {
    return
  }

  const surface = event.currentTarget.closest<HTMLElement>('.spotlight-surface')
  if (!surface) return

  const { left, top } = surface.getBoundingClientRect()
  surface.style.setProperty('--spotlight-x', `${event.clientX - left}px`)
  surface.style.setProperty('--spotlight-y', `${event.clientY - top}px`)
}
