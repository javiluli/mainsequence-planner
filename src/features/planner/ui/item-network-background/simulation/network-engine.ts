import { LINK_REFRESH_INTERVAL, MIN_LINK_RADIUS, MAX_LINK_RADIUS, NODE_COUNT_HYSTERESIS, RESIZE_SETTLE_DURATION } from '../network.config'
import { clamp, distanceSquared } from '../lib/math'
import type { NetworkCatalogItem, NetworkNode, NetworkViewport, Point } from '../network.types'
import { NodePopulation } from './node-population'
import { NetworkTopology } from './network-topology'
import { updateWander, applyPairForces, applyBounds, integrate } from './node-motion'

/** Coordinates simulation order. Population and topology each retain one owner. */
export class NetworkEngine {
  private readonly population: NodePopulation
  private readonly topology = new NetworkTopology()
  private viewport: NetworkViewport = { width: 0, height: 0 }
  private nodeRadius = 28
  private initialized = false
  private linkRefreshTimer = 0
  private resizeSettleRemaining = 0
  constructor(catalog: readonly NetworkCatalogItem[]) {
    this.population = new NodePopulation({ catalog, onRemove: (uid) => this.topology.removeLinksForNode(uid) })
  }
  public step(deltaSeconds: number, timeSeconds: number) {
    if (!this.initialized) return
    const delta = clamp(deltaSeconds, 0, 0.04)
    this.resizeSettleRemaining = Math.max(0, this.resizeSettleRemaining - delta)
    this.population.updatePopulation(delta)
    this.population.updateAlpha(delta)
    const nodes = this.population.nodes
    updateWander(nodes, this.viewport, this.resizeSettleRemaining, delta, timeSeconds)
    applyPairForces(nodes, this.nodeRadius, delta)
    applyBounds(nodes, this.viewport, delta)
    integrate(nodes, this.resizeSettleRemaining, delta)
    this.linkRefreshTimer += delta
    if (this.linkRefreshTimer >= LINK_REFRESH_INTERVAL) {
      this.linkRefreshTimer = 0
      this.refreshLinks()
    }
    this.topology.updateLinks(delta)
  }
  public getNodes(): readonly NetworkNode[] {
    return this.population.nodes
  }
  public getNode(uid: number) {
    return this.population.nodesByUid.get(uid)
  }
  public getLinks() {
    return this.topology.getLinks()
  }
  public getLink(id: string) {
    return this.topology.getLink(id)
  }
  public settle() {
    this.population.settle()
    this.refreshLinks()
    this.topology.settle()
    this.linkRefreshTimer = 0
  }
  private refreshLinks() {
    this.topology.refreshLinks(this.population.nodes, this.getLinkRadius())
  }

  public setViewport(width: number, height: number, nodeRadius: number) {
    if (width <= 0 || height <= 0) {
      return
    }
    const previousWidth = this.viewport.width
    const previousHeight = this.viewport.height
    const hadViewport = previousWidth > 0 && previousHeight > 0
    if (width === previousWidth && height === previousHeight && nodeRadius === this.nodeRadius) return
    if (hadViewport) {
      const scaleX = width / previousWidth
      const scaleY = height / previousHeight
      for (const node of this.population.nodes) {
        node.x *= scaleX
        node.y *= scaleY
        node.vx *= Math.sqrt(clamp(scaleX, 0.5, 2))
        node.vy *= Math.sqrt(clamp(scaleY, 0.5, 2))
      }
      this.resizeSettleRemaining = RESIZE_SETTLE_DURATION
    }
    this.viewport = {
      width,
      height,
    }
    this.population.viewport = this.viewport
    this.nodeRadius = nodeRadius
    const nextTargetNodeCount = this.population.calculateTargetNodeCount(width, height)
    if (!this.initialized) {
      this.population.targetNodeCount = nextTargetNodeCount
      this.initialized = true
      for (let index = 0; index < this.population.targetNodeCount; index += 1) {
        this.population.spawnNode(false)
      }
      this.refreshLinks()
      return
    }
    if (Math.abs(nextTargetNodeCount - this.population.targetNodeCount) >= NODE_COUNT_HYSTERESIS) {
      this.population.targetNodeCount = nextTargetNodeCount
      this.population.reconcilePopulation()
    }
    this.refreshLinks()
  }

  public getLinkRadius() {
    const { width, height } = this.viewport
    return clamp(Math.min(width, height) * 0.285, MIN_LINK_RADIUS, MAX_LINK_RADIUS)
  }

  public hitTest(point: Point, baseRadius: number): NetworkNode | null {
    let selected: NetworkNode | null = null
    let selectedDistance = Number.POSITIVE_INFINITY
    for (const node of this.population.nodes) {
      if (node.alpha < 0.35) {
        continue
      }
      const currentDistance = distanceSquared(point, node)
      const radius = baseRadius * node.sizeScale * 1.35
      if (!node.retiring && currentDistance <= radius * radius && currentDistance < selectedDistance) {
        selected = node
        selectedDistance = currentDistance
      }
    }
    return selected
  }
}
