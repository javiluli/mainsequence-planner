import type { NetworkPalette } from './network.types'

/**
 * =============================================================
 * PALETA DE RESPALDO
 * =============================================================
 */

export const DEFAULT_NETWORK_PALETTE: NetworkPalette = {
  primary: {
    r: 228,
    g: 165,
    b: 44,
  },

  secondary: {
    r: 116,
    g: 162,
    b: 178,
  },

  divider: {
    r: 66,
    g: 71,
    b: 73,
  },

  content: {
    r: 23,
    g: 25,
    b: 26,
  },

  raw: {
    r: 160,
    g: 166,
    b: 169,
  },

  processed: {
    r: 217,
    g: 145,
    b: 84,
  },

  component: {
    r: 116,
    g: 162,
    b: 178,
  },
}

/**
 * =============================================================
 * DENSIDAD
 * =============================================================
 */

export const NODE_AREA_PIXELS = 33_000

export const MIN_NODE_COUNT = 26
export const MAX_NODE_COUNT = 94

export const NODE_COUNT_HYSTERESIS = 3
export const NODE_SPAWN_RATE = 8

/**
 * Cantidad de posiciones candidatas evaluadas al crear un nodo.
 *
 * Evita grandes huecos sin convertir la composición
 * en una cuadrícula uniforme.
 */
export const NODE_PLACEMENT_CANDIDATES = 28

/**
 * =============================================================
 * NODOS
 * =============================================================
 */

export const MIN_NODE_RADIUS = 25
export const MAX_NODE_RADIUS = 35

export const NODE_FADE_SPEED = 2.4

/**
 * =============================================================
 * CAMPO DE MOVIMIENTO COMPARTIDO
 * =============================================================
 */

export const FIELD_AMPLITUDE_X = 17
export const FIELD_AMPLITUDE_Y = 13

export const FIELD_SPEED_X = 0.07
export const FIELD_SPEED_Y = 0.061

/**
 * =============================================================
 * ROAMING DE LARGO ALCANCE
 * =============================================================
 *
 * Hace que los nodos exploren lentamente una zona mayor.
 *
 * Es lo que permite que las conexiones cambien con el tiempo.
 */

export const MIN_ROAM_RADIUS_X = 38
export const MAX_ROAM_RADIUS_X = 84

export const MIN_ROAM_RADIUS_Y = 30
export const MAX_ROAM_RADIUS_Y = 66

export const MIN_ROAM_SPEED = 0.038
export const MAX_ROAM_SPEED = 0.072

/**
 * =============================================================
 * MICRO MOVIMIENTO INDIVIDUAL
 * =============================================================
 */

export const MIN_ORBIT_RADIUS_X = 5
export const MAX_ORBIT_RADIUS_X = 14

export const MIN_ORBIT_RADIUS_Y = 4
export const MAX_ORBIT_RADIUS_Y = 11

export const MIN_ORBIT_SPEED = 0.08
export const MAX_ORBIT_SPEED = 0.145

export const SECONDARY_WANDER_STRENGTH = 2.8

/**
 * Fuerza con la que el nodo persigue su posición ambiental.
 */
export const ORBIT_SPRING_STRENGTH = 0.21

export const VELOCITY_DAMPING = 0.96

export const MAX_NODE_SPEED = 18

/**
 * =============================================================
 * RESIZE
 * =============================================================
 */

export const RESIZE_SETTLE_DURATION = 0.42

export const RESIZE_SPRING_MULTIPLIER = 3.4

export const RESIZE_VELOCITY_DAMPING = 0.925

export const RESIZE_SETTLE_THRESHOLD = 3

/**
 * =============================================================
 * SEPARACIÓN ENTRE NODOS
 * =============================================================
 */

export const COLLISION_DISTANCE_FACTOR = 1.3

export const COLLISION_ACCELERATION = 44

export const SOFT_REPULSION_DISTANCE_FACTOR = 2.2

export const SOFT_REPULSION_ACCELERATION = 4.2

/**
 * =============================================================
 * OVERSCAN / BORDES
 * =============================================================
 */

export const MIN_HORIZONTAL_OVERSCAN = 190
export const MIN_VERTICAL_OVERSCAN = 135

export const HORIZONTAL_OVERSCAN_RATIO = 0.15
export const VERTICAL_OVERSCAN_RATIO = 0.14

export const BOUNDARY_SPRING_STRENGTH = 0.18

/**
 * =============================================================
 * ZONA CENTRAL
 * =============================================================
 *
 * Protege el copy central sin producir un agujero evidente.
 */

export const CENTER_RADIUS_X_RATIO = 0.145
export const CENTER_RADIUS_X_MIN = 165
export const CENTER_RADIUS_X_MAX = 290

export const CENTER_RADIUS_Y_RATIO = 0.105
export const CENTER_RADIUS_Y_MIN = 84
export const CENTER_RADIUS_Y_MAX = 126

export const CENTER_AVOIDANCE_ACCELERATION = 23

/**
 * Las conexiones pueden atravesar la zona central,
 * pero se atenúan ligeramente.
 */
export const CENTER_LINK_ALPHA = 0.42

/**
 * =============================================================
 * CONEXIONES
 * =============================================================
 */

export const MIN_LINK_RADIUS = 245
export const MAX_LINK_RADIUS = 390

/**
 * Histeresis:
 *
 * crear una conexión exige estar algo más cerca que
 * la distancia necesaria para conservarla.
 */
export const LINK_CONNECT_THRESHOLD = 0.96
export const LINK_DISCONNECT_THRESHOLD = 1.14

export const LINK_REFRESH_INTERVAL = 0.13

export const LINK_FADE_SPEED = 3.5

/**
 * Capacidad topológica.
 */
export const DEFAULT_MAX_LINKS = 2
export const EXTENDED_MAX_LINKS = 3
export const HUB_MAX_LINKS = 4

export const HUB_CHANCE = 0.18
export const EXTENDED_LINK_CHANCE = 0.64

/**
 * Rompe ligeramente la selección puramente matemática
 * del vecino más cercano.
 */
export const LINK_SELECTION_RANDOMNESS = 18

/**
 * Favorece conexiones existentes sin impedir
 * que la topología termine cambiando.
 */
export const LINK_PERSISTENCE_BONUS = 14

/**
 * =============================================================
 * SEÑALES
 * =============================================================
 */

export const SIGNAL_LINK_RATIO = 0.34

/**
 * Ciclos por segundo.
 */
export const MIN_SIGNAL_SPEED = 0.075
export const MAX_SIGNAL_SPEED = 0.125

export const SIGNAL_TRAIL_LENGTH = 0.11

/**
 * Mezcla entre desplazamiento lineal y smootherstep.
 */
export const SIGNAL_EASING_STRENGTH = 0.48

/**
 * Pequeña pausa tras desaparecer completamente el impacto.
 */
export const SIGNAL_RESTART_GAP_SECONDS = 0.16

/**
 * =============================================================
 * IMPACTO CINEMATOGRÁFICO
 * =============================================================
 *
 * Timeline aproximada:
 *
 * 0 ms      contacto
 * ~90 ms    máximo brillo
 * ~360 ms   termina el settle
 * ~1260 ms  termina el hold
 * ~3600 ms  desaparición completa
 */

export const IMPACT_DURATION_SECONDS = 3.6

/**
 * Flash inicial.
 *
 * 3.6 × 0.025 ≈ 90 ms.
 */
export const IMPACT_PEAK = 0.025

/**
 * Tras el flash se produce una pequeña estabilización.
 *
 * 3.6 × 0.10 ≈ 360 ms.
 */
export const IMPACT_SETTLE_END = 0.1

/**
 * Final del mantenimiento.
 *
 * 3.6 × 0.35 ≈ 1260 ms.
 */
export const IMPACT_HOLD_END = 0.35

/**
 * Cada capa conserva una intensidad diferente durante el hold.
 *
 * Esto evita que todo el efecto parezca una sola imagen
 * cambiando únicamente de opacity.
 */
export const IMPACT_CORONA_HOLD_LEVEL = 0.76
export const IMPACT_LIMB_HOLD_LEVEL = 0.93
export const IMPACT_BEAD_HOLD_LEVEL = 0.8
export const IMPACT_GLINT_HOLD_LEVEL = 0.58

/**
 * Velocidad relativa de desaparición.
 *
 * Exponente menor = conserva la intensidad durante más tiempo.
 *
 * Corona → desaparece última.
 * Limbo  → segunda.
 * Bead   → antes.
 * Glint  → primero.
 */
export const IMPACT_CORONA_DECAY_POWER = 0.4
export const IMPACT_LIMB_DECAY_POWER = 0.56
export const IMPACT_BEAD_DECAY_POWER = 0.9
export const IMPACT_GLINT_DECAY_POWER = 1.18

/**
 * Intensidad visual.
 */
export const IMPACT_CORONA_ALPHA = 0.16
export const IMPACT_LIMB_ALPHA = 0.72
export const IMPACT_BEAD_ALPHA = 0.92

/**
 * Extensión angular.
 */
export const IMPACT_CORONA_ARC_SPAN = Math.PI * 0.92
export const IMPACT_LIMB_ARC_SPAN = Math.PI * 0.42

/**
 * Expansión lenta de la corona durante el decay.
 */
export const IMPACT_CORONA_EXPANSION = 0.11

/**
 * Blur.
 */
export const IMPACT_CORONA_BLUR = 16
export const IMPACT_LIMB_BLUR = 7

/**
 * Diamond point.
 */
export const IMPACT_BEAD_RADIUS = 1.05

/**
 * Pequeño destello tangencial.
 */
export const IMPACT_GLINT_LENGTH = 4.5

/**
 * Caída lateral de la iluminación.
 */
export const IMPACT_LIMB_FALLOFF = 2.65
export const IMPACT_CORONA_FALLOFF = 2.15

/**
 * =============================================================
 * CURSOR
 * =============================================================
 */

export const MIN_POINTER_RADIUS = 180
export const MAX_POINTER_RADIUS = 290

/**
 * =============================================================
 * CANVAS
 * =============================================================
 */

export const MAX_DEVICE_PIXEL_RATIO = 2
