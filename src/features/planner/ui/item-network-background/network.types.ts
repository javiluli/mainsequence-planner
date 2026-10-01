import type { ItemType } from '@/shared/@types/item.type'

export type Point = {
  x: number
  y: number
}

export type RGB = {
  r: number
  g: number
  b: number
}

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

export type NetworkSignal = {
  startedAt: number
  duration: number
  progress: number
}

export type NetworkImpact = {
  id: number
  targetUid: number
  angle: number
  startedAt: number
  duration: number
  strength: number
  progress: number
}
