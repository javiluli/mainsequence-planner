/**
 * Colores semanticos usados por React Flow.
 *
 * HeroUI expone canales HSL en `--heroui-*`; React Flow necesita recibir el
 * color CSS completo en sus propiedades JavaScript. Los colores de dominio
 * siguen viviendo como tokens Tailwind en `src/index.css`.
 */
export const FLOW_COLORS = {
  canvas: 'hsl(var(--heroui-background) / 1)',
  grid: 'hsl(var(--heroui-content3) / 0.4)',
  labelBackground: 'hsl(var(--heroui-background) / 1)',
  labelText: 'hsl(var(--heroui-foreground) / 1)',
  supplyEdge: 'var(--color-item-component)',
} as const
