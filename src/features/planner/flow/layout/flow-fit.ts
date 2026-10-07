type FitView = (options: { padding: number; duration: number }) => unknown

/** Wait for React Flow's node measurements; cancel the pending fit when the view changes or unmounts. */
export const scheduleFlowFitView = (fitView: FitView, reduceMotion = false) => {
  const timeoutId = globalThis.setTimeout(() => {
    fitView({ padding: 0.08, duration: reduceMotion ? 0 : 600 })
  }, 100)

  return () => globalThis.clearTimeout(timeoutId)
}
