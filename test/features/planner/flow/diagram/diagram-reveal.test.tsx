/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlannerDiagramReveal } from '@/features/planner/flow/diagram/diagram-reveal'

beforeEach(() => {
  // jsdom has no Canvas 2D renderer; the real animation is checked in a browser.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PlannerDiagramReveal', () => {
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
