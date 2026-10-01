import { IMPACT_DURATION_SECONDS, SIGNAL_EASING_STRENGTH, SIGNAL_RESTART_GAP_SECONDS } from '../network.config'
import type { NetworkEngine } from '../simulation/network-engine'
import { clamp, lerp, smootherstep } from '../lib/math'
import type { NetworkImpact, NetworkSignal } from '../network.types'

type SignalCycle = { kind: 'waiting'; startsAt: number } | { kind: 'travelling'; signal: NetworkSignal }

export const getSignalTravelProgress = (progress: number) => lerp(progress, smootherstep(progress), SIGNAL_EASING_STRENGTH)
export const getSignalAlpha = (progress: number) => smootherstep(progress / 0.055) * (1 - smootherstep((progress - 0.94) / 0.06) * 0.38)

/** Signals own the contact event; the renderer never starts, replaces or expires an impact. */
export class NetworkAnimation {
  private readonly cycles = new Map<string, SignalCycle>()
  private readonly impacts: NetworkImpact[] = []
  private nextImpactId = 1
  private time = 0

  public step(deltaSeconds: number, engine: NetworkEngine) {
    this.time += clamp(deltaSeconds, 0, 0.04)

    for (const id of this.cycles.keys()) {
      if (!engine.getLink(id)) this.cycles.delete(id)
    }

    for (const link of engine.getLinks()) {
      if (!link.signal) continue
      const source = engine.getNode(link.sourceUid)
      const target = engine.getNode(link.targetUid)
      if (!source || !target) continue
      const alpha = link.alpha * source.alpha * target.alpha
      const ready = link.targetAlpha > 0 && !source.retiring && !target.retiring && alpha >= 0.12
      let cycle = this.cycles.get(link.id)

      if (!cycle) {
        if (!ready) continue
        cycle = { kind: 'waiting', startsAt: this.time + link.signalPhase / link.signalSpeed }
        this.cycles.set(link.id, cycle)
      }

      if (cycle.kind === 'waiting') {
        if (!ready || this.time < cycle.startsAt) continue
        const duration = Math.max(0.5, 1 / link.signalSpeed - IMPACT_DURATION_SECONDS - SIGNAL_RESTART_GAP_SECONDS)
        cycle = {
          kind: 'travelling',
          signal: { startedAt: this.time, duration, progress: 0 },
        }
        this.cycles.set(link.id, cycle)
      }

      const signal = cycle.signal
      signal.progress = clamp((this.time - signal.startedAt) / signal.duration, 0, 1)
      if (signal.progress < 1) continue

      // Store the incoming angle and strength at contact. Losing the link or moving its source cannot change this lifecycle.
      if (alpha >= 0.12) {
        this.impacts.push({
          id: this.nextImpactId++,
          targetUid: target.uid,
          angle: Math.atan2(source.y - target.y, source.x - target.x),
          startedAt: signal.startedAt + signal.duration,
          duration: IMPACT_DURATION_SECONDS,
          strength: alpha,
          progress: 0,
        })
      }
      this.cycles.set(link.id, { kind: 'waiting', startsAt: this.time + IMPACT_DURATION_SECONDS + SIGNAL_RESTART_GAP_SECONDS })
    }

    for (let index = this.impacts.length - 1; index >= 0; index -= 1) {
      const impact = this.impacts[index]
      impact.progress = clamp((this.time - impact.startedAt) / impact.duration, 0, 1)
      if (impact.progress >= 1 || !engine.getNode(impact.targetUid)) this.impacts.splice(index, 1)
    }
  }

  public getSignal(linkId: string): NetworkSignal | null {
    const cycle = this.cycles.get(linkId)
    return cycle?.kind === 'travelling' ? cycle.signal : null
  }

  public getImpacts(): readonly NetworkImpact[] {
    return this.impacts
  }

  public clear() {
    this.cycles.clear()
    this.impacts.length = 0
  }
}
