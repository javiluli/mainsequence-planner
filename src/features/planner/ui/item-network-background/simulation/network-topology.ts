import {
  LINK_CONNECT_THRESHOLD,
  LINK_DISCONNECT_THRESHOLD,
  LINK_FADE_SPEED,
  LINK_PERSISTENCE_BONUS,
  LINK_SELECTION_RANDOMNESS,
  MAX_SIGNAL_SPEED,
  MIN_SIGNAL_SPEED,
  SIGNAL_LINK_RATIO,
} from '../network.config'
import { distanceSquared } from '../lib/math'
import type { NetworkLink, NetworkNode } from '../network.types'

type CandidateLink = { id: string; source: NetworkNode; target: NetworkNode; priority: number; seed: number }

const hashString = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

/** Owns proximity links, degree limits, hysteresis and fade-out. */
export class NetworkTopology {
  private readonly links = new Map<string, NetworkLink>()
  public getLinks() {
    return this.links.values()
  }
  public getLink(id: string) {
    return this.links.get(id)
  }
  public settle() {
    for (const [id, link] of this.links) {
      if (link.targetAlpha === 0) this.links.delete(id)
      else link.alpha = 1
    }
  }

  public refreshLinks(nodes: readonly NetworkNode[], linkRadius: number) {
    const connectRadius = linkRadius * LINK_CONNECT_THRESHOLD
    const disconnectRadius = linkRadius * LINK_DISCONNECT_THRESHOLD
    const candidates: CandidateLink[] = []
    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      const source = nodes[firstIndex]
      if (source.retiring || source.alpha < 0.08) {
        continue
      }
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const target = nodes[secondIndex]
        if (target.retiring || target.alpha < 0.08) {
          continue
        }
        const squared = distanceSquared(source, target)
        if (squared > disconnectRadius * disconnectRadius) continue
        const minimumUid = Math.min(source.uid, target.uid)
        const maximumUid = Math.max(source.uid, target.uid)
        const id = `${minimumUid}:${maximumUid}`
        const existing = this.links.get(id)?.targetAlpha === 1
        const threshold = existing ? disconnectRadius : connectRadius
        if (squared > threshold * threshold) {
          continue
        }
        const currentDistance = Math.sqrt(squared)
        const seed = hashString(id)
        const persistenceBonus = existing ? -LINK_PERSISTENCE_BONUS : 0
        candidates.push({
          id,
          source,
          target,
          priority: currentDistance + seed * LINK_SELECTION_RANDOMNESS + persistenceBonus,
          seed,
        })
      }
    }
    candidates.sort((first, second) => first.priority - second.priority)
    const degree = new Map<number, number>()
    const desired = new Map<string, CandidateLink>()
    for (const candidate of candidates) {
      const sourceDegree = degree.get(candidate.source.uid) ?? 0
      const targetDegree = degree.get(candidate.target.uid) ?? 0
      if (sourceDegree >= candidate.source.maxLinks || targetDegree >= candidate.target.maxLinks) {
        continue
      }
      desired.set(candidate.id, candidate)
      degree.set(candidate.source.uid, sourceDegree + 1)
      degree.set(candidate.target.uid, targetDegree + 1)
    }
    for (const [id, link] of this.links) {
      link.targetAlpha = desired.has(id) ? 1 : 0
    }
    for (const [id, candidate] of desired) {
      if (this.links.has(id)) {
        continue
      }
      this.links.set(id, {
        id,
        sourceUid: candidate.source.uid,
        targetUid: candidate.target.uid,
        alpha: 0,
        targetAlpha: 1,
        signal: candidate.seed < SIGNAL_LINK_RATIO,
        signalPhase: (candidate.seed * 7.13) % 1,
        signalSpeed: MIN_SIGNAL_SPEED + ((candidate.seed * 13.71) % 1) * (MAX_SIGNAL_SPEED - MIN_SIGNAL_SPEED),
      })
    }
  }

  public removeLinksForNode(uid: number) {
    for (const [id, link] of this.links) {
      if (link.sourceUid === uid || link.targetUid === uid) {
        this.links.delete(id)
      }
    }
  }

  public updateLinks(delta: number) {
    const response = Math.min(1, delta * LINK_FADE_SPEED)
    for (const link of this.links.values()) {
      link.alpha += (link.targetAlpha - link.alpha) * response
      if (link.targetAlpha === 0 && link.alpha < 0.012) {
        this.links.delete(link.id)
      }
    }
  }
}
