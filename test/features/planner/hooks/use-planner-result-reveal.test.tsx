/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePlannerResultReveal } from '@/features/planner/hooks/use-planner-result-reveal'

afterEach(() => {
  vi.useRealTimers()
})

describe('usePlannerResultReveal', () => {
  it('enters, waits at least 300 ms and reveals the plan only after the loading indicator exits', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => usePlannerResultReveal(true, false))

    expect(result.current).toBe('loading-enter')
    act(() => vi.advanceTimersByTime(160))
    expect(result.current).toBe('loading-hold')
    act(() => vi.advanceTimersByTime(139))
    expect(result.current).toBe('loading-hold')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('loading-exit')
    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe('content-enter')
    act(() => vi.advanceTimersByTime(220))
    expect(result.current).toBe('ready')
  })

  it('holds the loading indicator if the lazy planner is not ready after the minimum', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ ready }) => usePlannerResultReveal(ready, false), {
      initialProps: { ready: false },
    })

    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe('loading-hold')
    rerender({ ready: true })
    expect(result.current).toBe('loading-exit')
  })

  it('keeps the minimum hold but skips animation delays for reduced motion', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => usePlannerResultReveal(true, true))

    act(() => vi.advanceTimersByTime(0))
    expect(result.current).toBe('loading-hold')
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('loading-exit')
    act(() => vi.advanceTimersByTime(0))
    expect(result.current).toBe('ready')
  })
})
