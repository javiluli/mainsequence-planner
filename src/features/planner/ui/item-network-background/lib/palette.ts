import { DEFAULT_NETWORK_PALETTE } from '../network.config'
import { clamp, lerp } from './math'
import type { NetworkPalette, RGB } from '../network.types'

export const rgba = (color: RGB, alpha: number) =>
  `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${clamp(alpha, 0, 1)})`

export const mixRgb = (first: RGB, second: RGB, amount: number): RGB => ({
  r: lerp(first.r, second.r, clamp(amount, 0, 1)),
  g: lerp(first.g, second.g, clamp(amount, 0, 1)),
  b: lerp(first.b, second.b, clamp(amount, 0, 1)),
})

/** Resolve CSS colors only at mount/theme changes, not in the animation loop. Canvas also accepts modern CSS color spaces. */
export const readNetworkPalette = (container: HTMLElement): NetworkPalette => {
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  container.appendChild(probe)
  const styles = getComputedStyle(container)
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })

  const resolve = (variable: string, hsl: boolean, fallback: RGB): RGB => {
    if (!context || !styles.getPropertyValue(variable).trim()) return fallback
    probe.style.color = hsl ? `hsl(var(${variable}))` : `var(${variable})`
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = rgba(fallback, 1)
    context.fillStyle = getComputedStyle(probe).color
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return { r, g, b }
  }

  try {
    return {
      primary: resolve('--heroui-primary', true, DEFAULT_NETWORK_PALETTE.primary),
      secondary: resolve('--heroui-secondary', true, DEFAULT_NETWORK_PALETTE.secondary),
      content: resolve('--heroui-content1', true, DEFAULT_NETWORK_PALETTE.content),
      raw: resolve('--color-item-raw', false, DEFAULT_NETWORK_PALETTE.raw),
      processed: resolve('--color-item-processed', false, DEFAULT_NETWORK_PALETTE.processed),
      component: resolve('--color-item-component', false, DEFAULT_NETWORK_PALETTE.component),
    }
  } finally {
    probe.remove()
  }
}

const effectColors = new WeakMap<NetworkPalette, { corona: RGB; warm: RGB; hot: RGB }>()

export const getImpactColors = (palette: NetworkPalette) => {
  const cached = effectColors.get(palette)
  if (cached) return cached
  const colors = {
    corona: mixRgb(palette.primary, { r: 255, g: 210, b: 126 }, 0.18),
    warm: mixRgb(palette.primary, { r: 255, g: 205, b: 112 }, 0.22),
    hot: mixRgb(palette.primary, { r: 255, g: 246, b: 218 }, 0.58),
  }
  effectColors.set(palette, colors)
  return colors
}
