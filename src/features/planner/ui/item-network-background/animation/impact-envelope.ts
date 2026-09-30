import {
  IMPACT_BEAD_DECAY_POWER,
  IMPACT_BEAD_END,
  IMPACT_BEAD_HOLD_LEVEL,
  IMPACT_CORONA_DECAY_POWER,
  IMPACT_CORONA_HOLD_LEVEL,
  IMPACT_GLINT_DECAY_POWER,
  IMPACT_GLINT_END,
  IMPACT_GLINT_HOLD_LEVEL,
  IMPACT_HOLD_END,
  IMPACT_LIMB_DECAY_POWER,
  IMPACT_LIMB_END,
  IMPACT_LIMB_HOLD_LEVEL,
  IMPACT_PEAK,
  IMPACT_SETTLE_END,
} from '../network.config'
import { clamp, lerp, smootherstep } from '../lib/math'

type CinematicImpactEnvelope = { corona: number; limb: number; bead: number; glint: number }

const getImpactDecay = (decayProgress: number, holdLevel: number, power: number) => {
  const remaining = 1 - smootherstep(decayProgress)
  return holdLevel * Math.pow(remaining, power)
}
export const getCinematicImpactEnvelope = (progress: number): CinematicImpactEnvelope => {
  const t = clamp(progress, 0, 1)
  if (t <= IMPACT_PEAK) {
    const attack = smootherstep(t / IMPACT_PEAK)
    return {
      corona: attack,
      limb: attack,
      bead: attack,
      glint: attack,
    }
  }
  if (t <= IMPACT_SETTLE_END) {
    const settle = smootherstep((t - IMPACT_PEAK) / (IMPACT_SETTLE_END - IMPACT_PEAK))
    return {
      corona: lerp(1, IMPACT_CORONA_HOLD_LEVEL, settle),
      limb: lerp(1, IMPACT_LIMB_HOLD_LEVEL, settle),
      bead: lerp(1, IMPACT_BEAD_HOLD_LEVEL, settle),
      glint: lerp(1, IMPACT_GLINT_HOLD_LEVEL, settle),
    }
  }
  if (t <= IMPACT_HOLD_END) {
    return {
      corona: IMPACT_CORONA_HOLD_LEVEL,
      limb: IMPACT_LIMB_HOLD_LEVEL,
      bead: IMPACT_BEAD_HOLD_LEVEL,
      glint: IMPACT_GLINT_HOLD_LEVEL,
    }
  }
  const decay = clamp((t - IMPACT_HOLD_END) / (1 - IMPACT_HOLD_END), 0, 1)
  return {
    corona: getImpactDecay(decay, IMPACT_CORONA_HOLD_LEVEL, IMPACT_CORONA_DECAY_POWER),
    limb: getImpactDecay((t - IMPACT_HOLD_END) / (IMPACT_LIMB_END - IMPACT_HOLD_END), IMPACT_LIMB_HOLD_LEVEL, IMPACT_LIMB_DECAY_POWER),
    bead: getImpactDecay((t - IMPACT_HOLD_END) / (IMPACT_BEAD_END - IMPACT_HOLD_END), IMPACT_BEAD_HOLD_LEVEL, IMPACT_BEAD_DECAY_POWER),
    glint: getImpactDecay((t - IMPACT_HOLD_END) / (IMPACT_GLINT_END - IMPACT_HOLD_END), IMPACT_GLINT_HOLD_LEVEL, IMPACT_GLINT_DECAY_POWER),
  }
}
