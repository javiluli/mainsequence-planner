import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleFlowFitView } from './flow-fit'

afterEach(() => {
  vi.useRealTimers()
})

describe('scheduleFlowFitView', () => {
  it('adjusts the viewport after the graph has settled', () => {
    vi.useFakeTimers()
    const fitView = vi.fn(() => Promise.resolve(true))

    scheduleFlowFitView(fitView)
    vi.advanceTimersByTime(100)

    expect(fitView).toHaveBeenCalledWith({ padding: 0.08, duration: 600 })
  })

  it('cancels the pending adjustment when its owner unmounts', () => {
    vi.useFakeTimers()
    const fitView = vi.fn(() => Promise.resolve(true))

    const cancel = scheduleFlowFitView(fitView)
    cancel()
    vi.runAllTimers()

    expect(fitView).not.toHaveBeenCalled()
  })

  it('fits immediately without viewport animation when motion is reduced', () => {
    vi.useFakeTimers()
    const fitView = vi.fn(() => Promise.resolve(true))

    scheduleFlowFitView(fitView, true)
    vi.advanceTimersByTime(100)

    expect(fitView).toHaveBeenCalledWith({ padding: 0.08, duration: 0 })
  })
})
