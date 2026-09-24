type FitView = (options: { padding: number; duration: number }) => unknown

/**
 * Ejecuta fitView tras una espera breve para que el grafo termine su layout.
 *
 * @param fitView Callback de React Flow para ajustar el viewport.
 */
export const scheduleFlowFitView = (fitView: FitView, reduceMotion = false) => {
  const timeoutId = globalThis.setTimeout(() => {
    fitView({ padding: 0.08, duration: reduceMotion ? 0 : 600 })
  }, 100)

  return () => globalThis.clearTimeout(timeoutId)
}

/**
 * Indica si debemos re-centrar el flow por cambio de target.
 *
 * @param prevTargetId Id anterior.
 * @param nextTargetId Id actual.
 * @returns True si el target cambio.
 */
export const shouldFitFlowView = (prevTargetId: string, nextTargetId: string) => prevTargetId !== nextTargetId
