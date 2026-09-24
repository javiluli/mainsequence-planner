/**
 * Formatea minutos totales en un string de tiempo persistente hh:mm:ss.
 * @param totalMinutes Minutos calculados para la exportación.
 */
export const formatTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.floor(totalMinutes % 60)
  const s = Math.round((totalMinutes % 1) * 60)
  return `${h}h ${m}m ${s}s`
}
