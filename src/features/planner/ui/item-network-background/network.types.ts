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
  divider: RGB
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
 * Nodo mutable utilizado únicamente por el motor Canvas.
 *
 * React no observa estas propiedades, por lo que pueden
 * actualizarse en cada frame sin provocar renders.
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
   * Región base del nodo expresada relativamente al viewport.
   *
   * Puede quedar ligeramente fuera de [0, 1] para que la red
   * continúe visualmente más allá de los bordes.
   */
  homeXRatio: number
  homeYRatio: number

  /**
   * Oscilación individual de corto alcance.
   */
  phase: number
  secondaryPhase: number

  orbitRadiusX: number
  orbitRadiusY: number
  orbitSpeed: number

  /**
   * Movimiento de largo alcance.
   *
   * Es muy lento, pero suficientemente amplio para que los
   * vecinos de un nodo cambien con el paso del tiempo.
   */
  roamPhase: number
  roamSecondaryPhase: number

  roamRadiusX: number
  roamRadiusY: number
  roamSpeed: number

  sizeScale: number

  /**
   * Número máximo de conexiones simultáneas.
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
   * Sólo una parte de los enlaces transportan señales.
   */
  signal: boolean

  /**
   * Desfase para que todos los pulsos no comiencen a la vez.
   */
  signalPhase: number

  /**
   * Ciclos por segundo.
   */
  signalSpeed: number
}
