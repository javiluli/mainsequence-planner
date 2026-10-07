import {
  DEFAULT_MAX_LINKS,
  EXTENDED_LINK_CHANCE,
  EXTENDED_MAX_LINKS,
  HUB_CHANCE,
  HUB_MAX_LINKS,
  MAX_NODE_COUNT,
  MAX_ORBIT_RADIUS_X,
  MAX_ORBIT_RADIUS_Y,
  MAX_ORBIT_SPEED,
  MAX_ROAM_RADIUS_X,
  MAX_ROAM_RADIUS_Y,
  MAX_ROAM_SPEED,
  MIN_NODE_COUNT,
  MIN_ORBIT_RADIUS_X,
  MIN_ORBIT_RADIUS_Y,
  MIN_ORBIT_SPEED,
  MIN_ROAM_RADIUS_X,
  MIN_ROAM_RADIUS_Y,
  MIN_ROAM_SPEED,
  NODE_AREA_PIXELS,
  NODE_FADE_SPEED,
  NODE_PLACEMENT_CANDIDATES,
  NODE_SPAWN_RATE,
} from '../network.config'
import { distanceSquared, getCenterZone, getHorizontalOverscan, getVerticalOverscan, randomBetween, clamp } from '../lib/math'
import type { NetworkCatalogItem, NetworkNode, NetworkViewport, Point } from '../network.types'

/** Owns node identities, sampling, distribution and gradual population changes. */
export class NodePopulation {
  public readonly nodes: NetworkNode[] = []
  public readonly nodesByUid = new Map<number, NetworkNode>()
  public targetNodeCount = 0
  public viewport: NetworkViewport = { width: 0, height: 0 }
  private readonly catalog: readonly NetworkCatalogItem[]
  private readonly onRemove: (uid: number) => void
  private nextUid = 1
  private spawnBudget = 0

  constructor({ catalog, onRemove }: { catalog: readonly NetworkCatalogItem[]; onRemove: (uid: number) => void }) {
    this.catalog = catalog
    this.onRemove = onRemove
  }

  public calculateTargetNodeCount(width: number, height: number) {
    if (this.catalog.length === 0) return 0
    return Math.round(clamp((width * height) / NODE_AREA_PIXELS, MIN_NODE_COUNT, MAX_NODE_COUNT))
  }

  private isInsideCenterZone(x: number, y: number) {
    const { width, height } = this.viewport
    const { radiusX, radiusY } = getCenterZone(this.viewport.width, this.viewport.height)
    const dx = x - width / 2
    const dy = y - height / 2
    return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) < 1
  }

  private createMaxLinks() {
    const roll = Math.random()
    if (roll < HUB_CHANCE) {
      return HUB_MAX_LINKS
    }
    if (roll < HUB_CHANCE + EXTENDED_LINK_CHANCE) {
      return EXTENDED_MAX_LINKS
    }
    return DEFAULT_MAX_LINKS
  }

  private pickCatalogItem() {
    return this.catalog[Math.floor(Math.random() * this.catalog.length)]
  }

  private createHomePosition(): Point {
    const horizontalOverscan = getHorizontalOverscan(this.viewport.width)
    const verticalOverscan = getVerticalOverscan(this.viewport.height)
    let bestPoint: Point | null = null
    let bestScore = Number.NEGATIVE_INFINITY
    for (let attempt = 0; attempt < NODE_PLACEMENT_CANDIDATES; attempt += 1) {
      const point: Point = {
        x: randomBetween(-horizontalOverscan * 0.48, this.viewport.width + horizontalOverscan * 0.48),
        y: randomBetween(-verticalOverscan * 0.45, this.viewport.height + verticalOverscan * 0.45),
      }
      if (this.isInsideCenterZone(point.x, point.y)) {
        continue
      }
      if (this.nodes.length === 0) {
        return point
      }
      let minimumDistanceSquared = Number.POSITIVE_INFINITY
      for (const node of this.nodes) {
        if (node.retiring) {
          continue
        }
        minimumDistanceSquared = Math.min(minimumDistanceSquared, distanceSquared(point, node))
      }
      const insideViewport = point.x >= 0 && point.x <= this.viewport.width && point.y >= 0 && point.y <= this.viewport.height
      const visibilityWeight = insideViewport ? 1 : 0.76
      const score = minimumDistanceSquared * visibilityWeight
      if (score > bestScore) {
        bestScore = score
        bestPoint = point
      }
    }
    if (bestPoint) {
      return bestPoint
    }
    return {
      x: randomBetween(0, this.viewport.width),
      y: randomBetween(0, this.viewport.height),
    }
  }

  public spawnNode(fadeIn: boolean) {
    const item = this.pickCatalogItem()
    if (!item) return
    const home = this.createHomePosition()
    const { width, height } = this.viewport
    const node: NetworkNode = {
      uid: this.nextUid++,
      itemId: item.id,
      itemName: item.name,
      itemType: item.type,
      x: home.x + randomBetween(-4, 4),
      y: home.y + randomBetween(-4, 4),
      vx: randomBetween(-0.35, 0.35),
      vy: randomBetween(-0.35, 0.35),
      homeXRatio: home.x / Math.max(width, 1),
      homeYRatio: home.y / Math.max(height, 1),
      phase: randomBetween(0, Math.PI * 2),
      secondaryPhase: randomBetween(0, Math.PI * 2),
      orbitRadiusX: randomBetween(MIN_ORBIT_RADIUS_X, MAX_ORBIT_RADIUS_X),
      orbitRadiusY: randomBetween(MIN_ORBIT_RADIUS_Y, MAX_ORBIT_RADIUS_Y),
      orbitSpeed: randomBetween(MIN_ORBIT_SPEED, MAX_ORBIT_SPEED),
      roamPhase: randomBetween(0, Math.PI * 2),
      roamSecondaryPhase: randomBetween(0, Math.PI * 2),
      roamRadiusX: randomBetween(MIN_ROAM_RADIUS_X, MAX_ROAM_RADIUS_X),
      roamRadiusY: randomBetween(MIN_ROAM_RADIUS_Y, MAX_ROAM_RADIUS_Y),
      roamSpeed: randomBetween(MIN_ROAM_SPEED, MAX_ROAM_SPEED),
      sizeScale: randomBetween(0.94, 1.06),
      maxLinks: this.createMaxLinks(),
      alpha: fadeIn ? 0 : 1,
      targetAlpha: 1,
      retiring: false,
    }
    this.nodes.push(node)
    this.nodesByUid.set(node.uid, node)
  }

  private removeNode(node: NetworkNode) {
    const index = this.nodes.indexOf(node)
    if (index >= 0) {
      this.nodes.splice(index, 1)
    }
    this.nodesByUid.delete(node.uid)
    this.onRemove(node.uid)
  }

  public reconcilePopulation() {
    const activeNodes = this.nodes.filter((node) => !node.retiring)
    if (activeNodes.length > this.targetNodeCount) {
      const excess = activeNodes.length - this.targetNodeCount
      const centerX = this.viewport.width / 2
      const centerY = this.viewport.height / 2
      const candidates = [...activeNodes].sort((first, second) => {
        const firstDistance = Math.hypot(first.x - centerX, first.y - centerY)
        const secondDistance = Math.hypot(second.x - centerX, second.y - centerY)
        return secondDistance - firstDistance
      })
      for (let index = 0; index < excess; index += 1) {
        candidates[index].retiring = true
        candidates[index].targetAlpha = 0
      }
    }
    if (activeNodes.length < this.targetNodeCount) {
      let missing = this.targetNodeCount - activeNodes.length
      for (const node of this.nodes) {
        if (missing <= 0) {
          break
        }
        if (!node.retiring) {
          continue
        }
        node.retiring = false
        node.targetAlpha = 1
        missing -= 1
      }
    }
  }

  public updatePopulation(delta: number) {
    let activeCount = 0
    for (const node of this.nodes) if (!node.retiring) activeCount += 1
    if (activeCount < this.targetNodeCount) {
      this.spawnBudget += delta * NODE_SPAWN_RATE
      const missing = this.targetNodeCount - activeCount
      const amount = Math.min(missing, Math.floor(this.spawnBudget))
      if (amount > 0) {
        this.spawnBudget -= amount
        for (let index = 0; index < amount; index += 1) {
          this.spawnNode(true)
        }
      }
    } else {
      this.spawnBudget = 0
    }
    for (let index = this.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.nodes[index]
      if (node.retiring && node.alpha < 0.015) this.removeNode(node)
    }
  }

  public updateAlpha(delta: number) {
    const response = Math.min(1, delta * NODE_FADE_SPEED)
    for (const node of this.nodes) {
      node.alpha += (node.targetAlpha - node.alpha) * response
    }
  }

  public settle() {
    this.reconcilePopulation()
    for (let index = this.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.nodes[index]
      if (node.retiring) this.removeNode(node)
      else node.alpha = 1
    }
    while (this.nodes.length < this.targetNodeCount) this.spawnNode(false)
    this.spawnBudget = 0
  }
}
