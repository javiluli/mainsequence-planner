// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { lazy, type ComponentType, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlannerDiagramReveal, type PlannerDiagramContentProps } from '@/features/planner/flow/diagram/diagram-reveal'

// Canvas drawing is checked in Chrome; these regressions own reveal, readiness and focus.
vi.mock('thinking-orbs', () => ({ ThinkingOrb: () => <span aria-hidden="true">Orb</span> }))

let reducedMotion = false
const mediaListeners = new Set<() => void>()

/** Controls a real suspended module independently of presentation timing. */
const pendingDiagram = () => {
  let resolve!: (module: { default: ComponentType<PlannerDiagramContentProps> }) => void
  const promise = new Promise<{ default: ComponentType<PlannerDiagramContentProps> }>((complete) => {
    resolve = complete
  })
  return { Content: lazy(() => promise), resolve }
}

/** Advances the cancelable presentation stages without fixing exact easing or duration assertions. */
const finishPresentation = () => {
  for (let step = 0; step < 3; step++) act(() => vi.advanceTimersByTime(1000))
}

beforeEach(() => {
  vi.useFakeTimers()
  reducedMotion = false
  mediaListeners.clear()
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reducedMotion
    },
    addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener),
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('PlannerDiagramReveal presentation', () => {
  it('shows Orb and keeps the first prepared result out of focus until the exit finishes', () => {
    render(<PlannerDiagramReveal label="Tree list" Content={() => <button>Tree content</button>} />)
    expect(screen.getByRole('status', { name: 'Loading Tree list' })).toBeVisible()
    expect(screen.getByText('Orb')).toBeInTheDocument()
    expect(screen.getByText('Tree content').closest('[inert][aria-hidden=true]')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Tree content').closest('[inert]')).not.toBeNull()
    finishPresentation()
    const content = screen.getByRole('button', { name: 'Tree content' })
    content.focus()
    expect(content).toHaveFocus()
    expect(content.closest('[inert]')).toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('fades a prepared view without another Orb hold and does not replay when the target is marked presented', () => {
    const view = render(<PlannerDiagramReveal label="Items" showLoading={false} Content={() => <button>Prepared items</button>} />)
    const content = screen.getByRole('button', { name: 'Prepared items' })
    content.focus()
    expect(content).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    finishPresentation()
    view.rerender(<PlannerDiagramReveal label="Items" showLoading={false} Content={() => <button>Prepared items</button>} />)
    expect(view.container.querySelector('[data-reveal-phase]')).toHaveAttribute('data-reveal-phase', 'ready')
  })

  it('keeps feedback for a real suspension, then exits before exposing the resolved content', async () => {
    const pending = pendingDiagram()
    render(<PlannerDiagramReveal label="Network graph" showLoading={false} Content={pending.Content} />)
    finishPresentation()
    expect(screen.getByRole('status', { name: 'Loading Network graph' })).toBeVisible()
    await act(async () => pending.resolve({ default: () => <button>Graph content</button> }))
    expect(screen.getByText('Graph content').closest('[inert]')).not.toBeNull()
    finishPresentation()
    expect(screen.getByRole('button', { name: 'Graph content' })).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('requires the graph measurement signal rather than treating its mount as readiness', () => {
    const Content = vi.fn<(props: PlannerDiagramContentProps) => ReactNode>(() => <button>Measured graph</button>)
    render(<PlannerDiagramReveal label="Network graph" waitForReady Content={Content} />)
    finishPresentation()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Measured graph').closest('[inert]')).not.toBeNull()
    act(() => Content.mock.calls.at(-1)?.[0].onReady?.())
    finishPresentation()
    expect(screen.getByRole('button', { name: 'Measured graph' })).toBeVisible()
  })

  it('does not publish an obsolete lazy result after changing the keyed context', async () => {
    const pending = pendingDiagram()
    const view = render(<PlannerDiagramReveal key="old" label="Network graph" Content={pending.Content} />)
    view.rerender(<PlannerDiagramReveal key="current" label="Items" showLoading={false} Content={() => <button>Current items</button>} />)
    const current = screen.getByRole('button', { name: 'Current items' })
    current.focus()
    await act(async () => pending.resolve({ default: () => <button>Old graph</button> }))
    finishPresentation()
    expect(current).toBeVisible()
    expect(current).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Old graph' })).not.toBeInTheDocument()
  })

  it('cancels an owned presentation timer on unmount without publishing completion', () => {
    const scheduled = vi.spyOn(globalThis, 'setTimeout')
    const canceled = vi.spyOn(globalThis, 'clearTimeout')
    const onPresented = vi.fn()
    const view = render(<PlannerDiagramReveal label="Items" onPresented={onPresented} Content={() => <button>Items</button>} />)
    const timerIndex = scheduled.mock.calls.findIndex((call) => Number(call[1]) > 0)
    expect(timerIndex).toBeGreaterThanOrEqual(0)
    const timer = scheduled.mock.results[timerIndex].value
    view.unmount()
    expect(canceled).toHaveBeenCalledWith(timer)
    finishPresentation()
    expect(onPresented).not.toHaveBeenCalled()
    expect(view.container).toBeEmptyDOMElement()
  })

  it('does not resurrect pending content after unmount', async () => {
    const pending = pendingDiagram()
    const view = render(<PlannerDiagramReveal label="Network graph" Content={pending.Content} />)
    view.unmount()
    await act(async () => pending.resolve({ default: () => <button>Unmounted graph</button> }))
    finishPresentation()
    expect(view.container).toBeEmptyDOMElement()
  })

  it('removes the deliberate wait when the live motion preference changes', () => {
    render(<PlannerDiagramReveal label="Items" Content={() => <button>Current items</button>} />)
    expect(screen.getByText('Current items').closest('[inert]')).not.toBeNull()
    act(() => {
      reducedMotion = true
      mediaListeners.forEach((listener) => listener())
    })
    act(() => vi.advanceTimersByTime(0))
    expect(screen.getByRole('button', { name: 'Current items' })).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps only the real data wait when reduced motion is already active', async () => {
    reducedMotion = true
    const pending = pendingDiagram()
    render(<PlannerDiagramReveal label="Items" Content={pending.Content} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => pending.resolve({ default: () => <button>Prepared items</button> }))
    expect(screen.getByRole('button', { name: 'Prepared items' })).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
