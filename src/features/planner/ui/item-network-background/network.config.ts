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

export const NODE_AREA_PIXELS = 33_000

export const MIN_NODE_COUNT = 26
export const MAX_NODE_COUNT = 94

export const NODE_COUNT_HYSTERESIS = 3
export const NODE_SPAWN_RATE = 8

export const NODE_PLACEMENT_CANDIDATES = 28

export const MIN_NODE_RADIUS = 25
export const MAX_NODE_RADIUS = 35

export const NODE_FADE_SPEED = 2.4

export const FIELD_AMPLITUDE_X = 17
export const FIELD_AMPLITUDE_Y = 13

export const FIELD_SPEED_X = 0.07
export const FIELD_SPEED_Y = 0.061

export const MIN_ROAM_RADIUS_X = 38
export const MAX_ROAM_RADIUS_X = 84

export const MIN_ROAM_RADIUS_Y = 30
export const MAX_ROAM_RADIUS_Y = 66

export const MIN_ROAM_SPEED = 0.038
export const MAX_ROAM_SPEED = 0.072

export const MIN_ORBIT_RADIUS_X = 5
export const MAX_ORBIT_RADIUS_X = 14

export const MIN_ORBIT_RADIUS_Y = 4
export const MAX_ORBIT_RADIUS_Y = 11

export const MIN_ORBIT_SPEED = 0.08
export const MAX_ORBIT_SPEED = 0.145

export const SECONDARY_WANDER_STRENGTH = 2.8

export const ORBIT_SPRING_STRENGTH = 0.21

export const VELOCITY_DAMPING = 0.96

export const MAX_NODE_SPEED = 18

export const RESIZE_SETTLE_DURATION = 0.42

export const RESIZE_SPRING_MULTIPLIER = 3.4

export const RESIZE_VELOCITY_DAMPING = 0.925

export const COLLISION_DISTANCE_FACTOR = 1.3

export const COLLISION_ACCELERATION = 44

export const SOFT_REPULSION_DISTANCE_FACTOR = 2.2

export const SOFT_REPULSION_ACCELERATION = 4.2

export const MIN_HORIZONTAL_OVERSCAN = 190
export const MIN_VERTICAL_OVERSCAN = 135

export const HORIZONTAL_OVERSCAN_RATIO = 0.15
export const VERTICAL_OVERSCAN_RATIO = 0.14

export const BOUNDARY_SPRING_STRENGTH = 0.18

export const CENTER_RADIUS_X_RATIO = 0.145
export const CENTER_RADIUS_X_MIN = 165
export const CENTER_RADIUS_X_MAX = 290

export const CENTER_RADIUS_Y_RATIO = 0.105
export const CENTER_RADIUS_Y_MIN = 84
export const CENTER_RADIUS_Y_MAX = 126

export const CENTER_AVOIDANCE_ACCELERATION = 23

export const CENTER_LINK_ALPHA = 0.42

export const MIN_LINK_RADIUS = 245
export const MAX_LINK_RADIUS = 390

export const LINK_CONNECT_THRESHOLD = 0.96
export const LINK_DISCONNECT_THRESHOLD = 1.14

export const LINK_REFRESH_INTERVAL = 0.13

export const LINK_FADE_SPEED = 3.5

export const DEFAULT_MAX_LINKS = 2
export const EXTENDED_MAX_LINKS = 3
export const HUB_MAX_LINKS = 4

export const HUB_CHANCE = 0.18
export const EXTENDED_LINK_CHANCE = 0.64

export const LINK_SELECTION_RANDOMNESS = 18

export const LINK_PERSISTENCE_BONUS = 14

export const SIGNAL_LINK_RATIO = 0.34

export const MIN_SIGNAL_SPEED = 0.075
export const MAX_SIGNAL_SPEED = 0.125

// Fractional trail history, capped in CSS pixels so short links and mobile stay restrained.
export const SIGNAL_TRAIL_LENGTH = 0.11
export const SIGNAL_TRAIL_MAX_PIXELS = 26

export const SIGNAL_EASING_STRENGTH = 0.48

export const SIGNAL_RESTART_GAP_SECONDS = 0.16

export const IMPACT_DURATION_SECONDS = 3.6

export const IMPACT_PEAK = 0.025

export const IMPACT_SETTLE_END = 0.1

export const IMPACT_HOLD_END = 0.35

export const IMPACT_GLINT_END = 0.58
export const IMPACT_BEAD_END = 0.72
export const IMPACT_LIMB_END = 0.94

export const IMPACT_CORONA_HOLD_LEVEL = 0.76
export const IMPACT_LIMB_HOLD_LEVEL = 0.93
export const IMPACT_BEAD_HOLD_LEVEL = 0.8
export const IMPACT_GLINT_HOLD_LEVEL = 0.58

export const IMPACT_CORONA_DECAY_POWER = 0.4
export const IMPACT_LIMB_DECAY_POWER = 0.56
export const IMPACT_BEAD_DECAY_POWER = 0.9
export const IMPACT_GLINT_DECAY_POWER = 1.18

export const IMPACT_CORONA_ALPHA = 0.16
export const IMPACT_LIMB_ALPHA = 0.72
export const IMPACT_BEAD_ALPHA = 0.92

export const IMPACT_CORONA_ARC_SPAN = Math.PI * 0.92
export const IMPACT_LIMB_ARC_SPAN = Math.PI * 0.42

export const IMPACT_CORONA_EXPANSION = 0.11

export const IMPACT_CORONA_BLUR = 16
export const IMPACT_LIMB_BLUR = 7

export const IMPACT_BEAD_RADIUS = 1.05

export const IMPACT_GLINT_LENGTH = 4.5

export const IMPACT_LIMB_FALLOFF = 2.65
export const IMPACT_CORONA_FALLOFF = 2.15

export const MIN_POINTER_RADIUS = 180
export const MAX_POINTER_RADIUS = 290

export const MAX_DEVICE_PIXEL_RATIO = 2
