/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleSpotlightPointerMove } from '@/shared/ui/spotlight'

/** jsdom has no native PointerEvent; retain MouseEvent coordinates and explicit pointer identity. */
class TestPointerEvent extends MouseEvent {
  readonly pointerType: string

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerType = init.pointerType ?? 'mouse'
  }
}

let spotlightAllowed = true

beforeEach(() => {
  spotlightAllowed = true
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  vi.stubGlobal('matchMedia', () => ({ matches: spotlightAllowed }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('shared spotlight pointer handling', () => {
  it('uses the nearest owning surface when the header receives movement from a child', () => {
    render(
      <div className="spotlight-surface" data-testid="outer">
        <button className="spotlight-surface">
          <span onPointerMove={handleSpotlightPointerMove}>
            <span>Recipe choice</span>
          </span>
        </button>
      </div>,
    )
    const surface = screen.getByRole('button')
    const bounds = vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 20, 240, 60))

    fireEvent.pointerMove(screen.getByText('Recipe choice'), { clientX: 140, clientY: 35, pointerType: 'mouse' })

    expect(surface.style.getPropertyValue('--spotlight-x')).toBe('40px')
    expect(surface.style.getPropertyValue('--spotlight-y')).toBe('15px')
    expect(screen.getByTestId('outer').style.getPropertyValue('--spotlight-x')).toBe('')
    expect(bounds).toHaveBeenCalledTimes(1)
  })

  it('supports a handler attached to the control itself without rerendering or selecting it', () => {
    const clicked = vi.fn()
    const Content = vi.fn(() => (
      <button className="spotlight-surface" onPointerMove={handleSpotlightPointerMove} onClick={clicked}>
        Alternative recipe
      </button>
    ))
    render(<Content />)
    const surface = screen.getByRole('button')
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 30, 240, 60))

    fireEvent.pointerMove(surface, { clientX: 80, clientY: 45, pointerType: 'mouse' })
    fireEvent.pointerMove(surface, { clientX: 90, clientY: 50, pointerType: 'mouse' })

    expect(surface.style.getPropertyValue('--spotlight-x')).toBe('80px')
    expect(surface.style.getPropertyValue('--spotlight-y')).toBe('20px')
    expect(clicked).not.toHaveBeenCalled()
    expect(Content).toHaveBeenCalledTimes(1)
  })

  it.each(['touch', 'pen'])('does not read layout or write decoration for a %s pointer', (pointerType) => {
    render(
      <button className="spotlight-surface" onPointerMove={handleSpotlightPointerMove}>
        Choice
      </button>,
    )
    const surface = screen.getByRole('button')
    const bounds = vi.spyOn(surface, 'getBoundingClientRect')

    fireEvent.pointerMove(surface, { clientX: 80, clientY: 45, pointerType })

    expect(bounds).not.toHaveBeenCalled()
    expect(surface.style.getPropertyValue('--spotlight-x')).toBe('')
  })

  it('skips layout and decoration when capability or motion preferences disable the effect', () => {
    spotlightAllowed = false
    render(
      <button className="spotlight-surface" onPointerMove={handleSpotlightPointerMove}>
        Choice
      </button>,
    )
    const surface = screen.getByRole('button')
    const bounds = vi.spyOn(surface, 'getBoundingClientRect')

    fireEvent.pointerMove(surface, { clientX: 80, clientY: 45, pointerType: 'mouse' })

    expect(bounds).not.toHaveBeenCalled()
    expect(surface.style.getPropertyValue('--spotlight-x')).toBe('')
  })

  it('honors a live preference change and resumes using current coordinates', () => {
    render(
      <button className="spotlight-surface" onPointerMove={handleSpotlightPointerMove}>
        Choice
      </button>,
    )
    const surface = screen.getByRole('button')
    const bounds = vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 30, 240, 60))
    fireEvent.pointerMove(surface, { clientX: 80, clientY: 45, pointerType: 'mouse' })

    spotlightAllowed = false
    fireEvent.pointerMove(surface, { clientX: 90, clientY: 50, pointerType: 'mouse' })
    expect(bounds).toHaveBeenCalledTimes(1)
    expect(surface.style.getPropertyValue('--spotlight-x')).toBe('70px')

    spotlightAllowed = true
    fireEvent.pointerMove(surface, { clientX: 100, clientY: 55, pointerType: 'mouse' })
    expect(bounds).toHaveBeenCalledTimes(2)
    expect(surface.style.getPropertyValue('--spotlight-x')).toBe('90px')
  })

  it('leaves unrelated controls untouched when no decorated owner exists', () => {
    render(<button onPointerMove={handleSpotlightPointerMove}>Plain control</button>)
    const control = screen.getByRole('button')
    const bounds = vi.spyOn(control, 'getBoundingClientRect')

    fireEvent.pointerMove(control, { clientX: 80, clientY: 45, pointerType: 'mouse' })

    expect(bounds).not.toHaveBeenCalled()
    expect(control.style.getPropertyValue('--spotlight-x')).toBe('')
  })
})
