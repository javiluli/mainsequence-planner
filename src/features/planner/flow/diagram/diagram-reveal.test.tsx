/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlannerDiagramReveal } from './diagram-reveal'

beforeEach(() => {
  // jsdom has no Canvas 2D renderer; the real animation is checked in a browser.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PlannerDiagramReveal', () => {
  it('keeps controls and settings outside the animated loading region', () => {
    render(
      <>
        <div data-testid="diagram-tabs">Network graph · Tree list · Items</div>
        <PlannerDiagramReveal label="Network graph" Content={() => <div>Graph content</div>} />
        <div data-testid="planner-settings">Supply · Recipes</div>
      </>,
    )

    const diagram = screen.getByTestId('planner-diagram')
    expect(screen.getByRole('status', { name: /Loading network graph/i })).toBeTruthy()
    expect(diagram.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true')
    expect(diagram.contains(screen.getByTestId('diagram-tabs'))).toBe(false)
    expect(diagram.contains(screen.getByTestId('planner-settings'))).toBe(false)
    expect(screen.getByTestId('diagram-tabs').getAttribute('aria-hidden')).toBeNull()
    expect(screen.getByTestId('planner-settings').getAttribute('aria-hidden')).toBeNull()
  })

  it('fades in a prepared view without showing the loading indicator', () => {
    render(<PlannerDiagramReveal label="Tree list" Content={() => <div>Tree content</div>} skipLoading />)

    expect(screen.getByTestId('planner-diagram').getAttribute('data-reveal-phase')).toBe('content-enter')
    expect(screen.getByText('Tree content')).toBeTruthy()
    expect(screen.queryByRole('status', { name: /Loading Tree list/i })).toBeNull()
  })

  it('still shows loading feedback if a prepared view actually suspends', () => {
    const pending = new Promise<never>(() => {})
    const PendingContent = () => {
      throw pending
    }

    render(<PlannerDiagramReveal label="Network graph" Content={PendingContent} skipLoading />)

    expect(screen.getByRole('status', { name: /Loading Network graph/i })).toBeTruthy()
  })
})
