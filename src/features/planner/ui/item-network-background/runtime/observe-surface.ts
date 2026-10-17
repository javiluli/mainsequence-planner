import { MAX_DEVICE_PIXEL_RATIO } from '../network.config'

type SurfaceObservers = {
  container: HTMLElement
  onSize: (width: number, height: number) => void
  onVisibility: (visible: boolean) => void
  onDocumentVisibility: () => void
  onTheme: () => void
  onDpr: (dpr: number) => void
}

/** Browser observations only; no animation state or rendering is owned here. */
export const observeNetworkSurface = ({ container, onSize, onVisibility, onDocumentVisibility, onTheme, onDpr }: SurfaceObservers) => {
  let measurementFrame = 0
  let attempts = 0
  let disposed = false
  const measure = () => {
    const rect = container.getBoundingClientRect()
    onSize(rect.width, rect.height)
    return rect.width > 0 && rect.height > 0
  }
  const initialMeasure = () => {
    if (disposed) return
    // A zero-size parent can finish layout later; ResizeObserver takes over after these bounded retries.
    if (!measure() && ++attempts < 3 && !document.hidden) measurementFrame = requestAnimationFrame(initialMeasure)
  }
  const visibilityChange = () => {
    if (!document.hidden) measure()
    onDocumentVisibility()
  }
  const updateDpr = () => onDpr(Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO))

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) onSize(entry.contentRect.width, entry.contentRect.height)
  })
  const intersectionObserver = new IntersectionObserver(([entry]) => onVisibility(entry?.isIntersecting ?? false))
  const themeObserver = new MutationObserver(onTheme)
  const themeOptions = { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] }
  resizeObserver.observe(container)
  intersectionObserver.observe(container)
  themeObserver.observe(document.documentElement, themeOptions)
  themeObserver.observe(document.body, themeOptions)
  document.addEventListener('visibilitychange', visibilityChange)
  window.addEventListener('resize', updateDpr)
  initialMeasure()

  return () => {
    disposed = true
    cancelAnimationFrame(measurementFrame)
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    themeObserver.disconnect()
    document.removeEventListener('visibilitychange', visibilityChange)
    window.removeEventListener('resize', updateDpr)
  }
}
