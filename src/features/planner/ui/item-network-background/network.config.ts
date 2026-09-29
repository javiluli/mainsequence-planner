import type { NetworkPalette } from './network.types'

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
 *
 * No aumentamos el número simplemente para tapar huecos.
 *
 * Los huecos se corrigen mediante:
 * - mejor distribución inicial;
 * - roaming;
 * - mayor conectividad.
 */
export const NODE_AREA_PIXELS = 33_000

export const MIN_NODE_COUNT = 26
export const MAX_NODE_COUNT = 94

export const NODE_COUNT_HYSTERESIS = 3
export const NODE_SPAWN_RATE = 8

/**
 * Cantidad de posiciones candidatas estudiadas cuando aparece
 * un nodo.
 *
 * Elegimos la posición que mejor cubra una región poco ocupada.
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
 * MOVIMIENTO COLECTIVO
 * =============================================================
 *
 * Campo suave compartido por regiones próximas.
 */
export const FIELD_AMPLITUDE_X = 17
export const FIELD_AMPLITUDE_Y = 13

export const FIELD_SPEED_X = 0.07
export const FIELD_SPEED_Y = 0.061

/**
 * =============================================================
 * ROAMING
 * =============================================================
 *
 * Movimiento de largo alcance y muy lento.
 *
 * Esta capa es la que permite que la topología evolucione.
 *
 * Un nodo no queda eternamente orbitando alrededor del mismo
 * pequeño punto: explora lentamente una zona mucho mayor.
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
 *
 * Sólo evita que el roaming tenga aspecto matemático.
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
 * SEPARACIÓN
 * =============================================================
 */

export const COLLISION_DISTANCE_FACTOR = 1.3

export const COLLISION_ACCELERATION = 44

export const SOFT_REPULSION_DISTANCE_FACTOR = 2.2

export const SOFT_REPULSION_ACCELERATION = 4.2

/**
 * =============================================================
 * BORDES / INFINITO
 * =============================================================
 */

export const MIN_HORIZONTAL_OVERSCAN = 190
export const MIN_VERTICAL_OVERSCAN = 135

export const HORIZONTAL_OVERSCAN_RATIO = 0.15
export const VERTICAL_OVERSCAN_RATIO = 0.14

export const BOUNDARY_SPRING_STRENGTH = 0.18

/**
 * =============================================================
 * CENTRO
 * =============================================================
 *
 * Algo menor que antes.
 *
 * Protege el copy, pero evita la sensación de un enorme círculo
 * vacío programado alrededor del centro.
 */
export const CENTER_RADIUS_X_RATIO = 0.145
export const CENTER_RADIUS_X_MIN = 165
export const CENTER_RADIUS_X_MAX = 290

export const CENTER_RADIUS_Y_RATIO = 0.105
export const CENTER_RADIUS_Y_MIN = 84
export const CENTER_RADIUS_Y_MAX = 126

export const CENTER_AVOIDANCE_ACCELERATION = 23

/**
 * Las líneas sí pueden pasar detrás del texto.
 */
export const CENTER_LINK_ALPHA = 0.42

/**
 * =============================================================
 * CONEXIONES
 * =============================================================
 *
 * Un poco más de alcance para compensar la menor densidad.
 */
export const MIN_LINK_RADIUS = 245
export const MAX_LINK_RADIUS = 390

/**
 * Histeresis.
 *
 * Es más difícil crear una conexión que mantener una que ya
 * existe. Evita flickering continuo en el límite.
 */
export const LINK_CONNECT_THRESHOLD = 0.96
export const LINK_DISCONNECT_THRESHOLD = 1.14

/**
 * Recalculamos la topología unas 7-8 veces por segundo.
 */
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
 * Pequeña variación para que la solución no sea siempre
 * exclusivamente "los N vecinos matemáticamente más cercanos".
 */
export const LINK_SELECTION_RANDOMNESS = 18

/**
 * Ventaja de una conexión existente.
 *
 * Suficiente para aportar estabilidad, pero ya no tanta como para
 * impedir que el roaming cambie la topología.
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
 *
 * Aproximadamente un pulso cada 8-13 segundos por enlace activo.
 */
export const MIN_SIGNAL_SPEED = 0.075
export const MAX_SIGNAL_SPEED = 0.125

export const SIGNAL_TRAIL_LENGTH = 0.11

/**
 * Mezcla entre recorrido lineal y smootherstep.
 *
 * Evita movimiento mecánico sin generar aceleraciones exageradas.
 */
export const SIGNAL_EASING_STRENGTH = 0.48

/**
 * Duración absoluta aproximada del impacto.
 */
export const IMPACT_DURATION_SECONDS = 1.2

/**
 * Pequeña pausa después de la absorción.
 */
export const SIGNAL_RESTART_GAP_SECONDS = 0.16

/**
 * =============================================================
 * IMPACTO / ABSORCIÓN
 * =============================================================
 */

export const IMPACT_PEAK = 0.07

export const IMPACT_CORONA_ALPHA = 0.16
export const IMPACT_LIMB_ALPHA = 0.72
export const IMPACT_BEAD_ALPHA = 0.92

/**
 * Corona amplia, horizonte más concentrado.
 */
export const IMPACT_CORONA_ARC_SPAN = Math.PI * 0.92
export const IMPACT_LIMB_ARC_SPAN = Math.PI * 0.42

/**
 * Expansión muy pequeña.
 *
 * Queremos absorción, no una onda de choque.
 */
export const IMPACT_CORONA_EXPANSION = 0.11

export const IMPACT_CORONA_BLUR = 16
export const IMPACT_LIMB_BLUR = 7

export const IMPACT_BEAD_RADIUS = 1.05

export const IMPACT_GLINT_LENGTH = 4.5

/**
 * Caída progresiva hacia ambos extremos del arco.
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
