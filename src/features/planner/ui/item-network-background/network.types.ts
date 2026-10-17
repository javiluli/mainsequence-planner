import type { ItemType } from '@/shared/@types/item.type'

/** Surface-local coordinates in CSS pixels, before device-pixel-ratio scaling. */
export type Point = {
  x: number
  y: number
}

/** Color channels on the 0–255 scale; interpolation may retain fractional channel values. */
export type RGB = {
  r: number
  g: number
  b: number
}

/** Visible simulation bounds in CSS pixels; the backing canvas may use more physical pixels. */
export type NetworkViewport = {
  width: number
  height: number
}

export type NetworkPalette = {
  primary: RGB
  secondary: RGB
  content: RGB

  raw: RGB
  processed: RGB
  component: RGB
}

export type NetworkCatalogItem = {
  id: string
  name: string
  type: ItemType
}

/**
 * Estado mutable de un nodo del fondo.
 *
 * React no observa estas propiedades; el motor puede modificarlas
 * directamente en cada frame sin provocar renders React.
 */
export type NetworkNode = {
  uid: number

  itemId: string
  itemName: string
  itemType: ItemType

  x: number
  y: number

  vx: number
  vy: number

  /**
   * Región base del nodo, relativa al viewport.
   *
   * Puede quedar ligeramente fuera de [0, 1] para mantener
   * la sensación de una red que continúa fuera de pantalla.
   */
  homeXRatio: number
  homeYRatio: number

  /**
   * Movimiento individual de corto alcance.
   */
  phase: number
  secondaryPhase: number

  orbitRadiusX: number
  orbitRadiusY: number
  orbitSpeed: number

  /**
   * Movimiento lento de largo alcance.
   *
   * Permite que cambien los vecinos y, por tanto,
   * que la topología evolucione.
   */
  roamPhase: number
  roamSecondaryPhase: number

  roamRadiusX: number
  roamRadiusY: number
  roamSpeed: number

  sizeScale: number

  /**
   * Máximo de conexiones simultáneas.
   */
  maxLinks: number

  alpha: number
  targetAlpha: number

  retiring: boolean
}

/** Decorative proximity link; it conveys no game recipe, logistics connection or production rate. */
export type NetworkLink = {
  id: string

  sourceUid: number
  targetUid: number

  alpha: number
  targetAlpha: number

  /**
   * Sólo una parte de las conexiones transporta pulsos.
   */
  signal: boolean

  /**
   * Desfase para evitar que todos los pulsos estén sincronizados.
   */
  signalPhase: number

  /**
   * Ciclos por segundo.
   */
  signalSpeed: number
}

/** One pulse trip, timed in active simulation seconds with progress normalized to 0–1. */
export type NetworkSignal = {
  startedAt: number
  duration: number
  progress: number
}

/** Contact effect whose incoming angle and strength are captured once, independently of later link movement. */
export type NetworkImpact = {
  id: number
  targetUid: number
  angle: number
  startedAt: number
  duration: number
  strength: number
  progress: number
}
