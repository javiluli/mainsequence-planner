import { useEffect, useState } from 'react'

export type PlannerRevealPhase = 'loading-enter' | 'loading-hold' | 'loading-exit' | 'content-enter' | 'ready'

const MINIMUM_LOADING_MS = 300
const LOADING_ENTER_MS = 160
const LOADING_EXIT_MS = 150
const CONTENT_ENTER_MS = 220

/** Waits for both the lazy panels and a visible loading state before revealing a trustworthy plan. */
export function usePlannerResultReveal(contentReady: boolean, reduceMotion: boolean): PlannerRevealPhase {
  const [loadingEntered, setLoadingEntered] = useState(false)
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [loadingExited, setLoadingExited] = useState(false)
  const [contentEntered, setContentEntered] = useState(false)

  useEffect(() => {
    const enterTimer = globalThis.setTimeout(() => setLoadingEntered(true), reduceMotion ? 0 : LOADING_ENTER_MS)
    const minimumTimer = globalThis.setTimeout(() => setMinimumElapsed(true), MINIMUM_LOADING_MS)
    return () => {
      globalThis.clearTimeout(enterTimer)
      globalThis.clearTimeout(minimumTimer)
    }
  }, [reduceMotion])

  const canExit = loadingEntered && minimumElapsed && contentReady

  useEffect(() => {
    if (!canExit) return
    const timer = globalThis.setTimeout(() => setLoadingExited(true), reduceMotion ? 0 : LOADING_EXIT_MS)
    return () => globalThis.clearTimeout(timer)
  }, [canExit, reduceMotion])

  useEffect(() => {
    if (!loadingExited || reduceMotion) return
    const timer = globalThis.setTimeout(() => setContentEntered(true), CONTENT_ENTER_MS)
    return () => globalThis.clearTimeout(timer)
  }, [loadingExited, reduceMotion])

  if (!loadingEntered) return 'loading-enter'
  if (!canExit) return 'loading-hold'
  if (!loadingExited) return 'loading-exit'
  if (!reduceMotion && !contentEntered) return 'content-enter'
  return 'ready'
}
