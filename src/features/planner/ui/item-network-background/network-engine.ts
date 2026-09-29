import {
  BOUNDARY_SPRING_STRENGTH,
  CENTER_AVOIDANCE_ACCELERATION,
  CENTER_RADIUS_X_MAX,
  CENTER_RADIUS_X_MIN,
  CENTER_RADIUS_X_RATIO,
  CENTER_RADIUS_Y_MAX,
  CENTER_RADIUS_Y_MIN,
  CENTER_RADIUS_Y_RATIO,
  COLLISION_ACCELERATION,
  COLLISION_DISTANCE_FACTOR,
  DEFAULT_MAX_LINKS,
  EXTENDED_LINK_CHANCE,
  EXTENDED_MAX_LINKS,
  FIELD_AMPLITUDE_X,
  FIELD_AMPLITUDE_Y,
  FIELD_SPEED_X,
  FIELD_SPEED_Y,
  HORIZONTAL_OVERSCAN_RATIO,
  HUB_CHANCE,
  HUB_MAX_LINKS,
  LINK_CONNECT_THRESHOLD,
  LINK_DISCONNECT_THRESHOLD,
  LINK_FADE_SPEED,
  LINK_PERSISTENCE_BONUS,
  LINK_REFRESH_INTERVAL,
  LINK_SELECTION_RANDOMNESS,
  MAX_LINK_RADIUS,
  MAX_NODE_COUNT,
  MAX_NODE_SPEED,
  MAX_ORBIT_RADIUS_X,
  MAX_ORBIT_RADIUS_Y,
  MAX_ORBIT_SPEED,
  MAX_ROAM_RADIUS_X,
  MAX_ROAM_RADIUS_Y,
  MAX_ROAM_SPEED,
  MAX_SIGNAL_SPEED,
  MIN_HORIZONTAL_OVERSCAN,
  MIN_LINK_RADIUS,
  MIN_NODE_COUNT,
  MIN_ORBIT_RADIUS_X,
  MIN_ORBIT_RADIUS_Y,
  MIN_ORBIT_SPEED,
  MIN_ROAM_RADIUS_X,
  MIN_ROAM_RADIUS_Y,
  MIN_ROAM_SPEED,
  MIN_SIGNAL_SPEED,
  MIN_VERTICAL_OVERSCAN,
  NODE_AREA_PIXELS,
  NODE_COUNT_HYSTERESIS,
  NODE_FADE_SPEED,
  NODE_PLACEMENT_CANDIDATES,
  NODE_SPAWN_RATE,
  ORBIT_SPRING_STRENGTH,
  RESIZE_SETTLE_DURATION,
  RESIZE_SETTLE_THRESHOLD,
  RESIZE_SPRING_MULTIPLIER,
  RESIZE_VELOCITY_DAMPING,
  SECONDARY_WANDER_STRENGTH,
  SIGNAL_LINK_RATIO,
  SOFT_REPULSION_ACCELERATION,
  SOFT_REPULSION_DISTANCE_FACTOR,
  VELOCITY_DAMPING,
  VERTICAL_OVERSCAN_RATIO,
} from './network.config'

import type { NetworkCatalogItem, NetworkLink, NetworkNode, NetworkViewport, Point } from './network.types'

type CandidateLink = {
  id: string
  source: NetworkNode
  target: NetworkNode
  distance: number
  priority: number
  seed: number
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

const randomBetween = (minimum: number, maximum: number) => minimum + Math.random() * (maximum - minimum)

const hashString = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) / 4294967295
}

const distanceSquared = (first: Point, second: Point) => {
  const dx = second.x - first.x
  const dy = second.y - first.y
  return dx * dx + dy * dy
}

/**
 * Motor ambiental del fondo.
 *
 * Se mantiene completamente separado de React y Canvas.
 *
 * Sus responsabilidades son:
 * - población;
 * - movimiento;
 * - distribución;
 * - repulsión;
 * - resize;
 * - topología dinámica.
 */
export class NetworkEngine {
  private readonly catalog: readonly NetworkCatalogItem[]

  private readonly nodes: NetworkNode[] = []

  private readonly nodesByUid = new Map<number, NetworkNode>()

  private readonly links = new Map<string, NetworkLink>()

  private viewport: NetworkViewport = {
    width: 0,
    height: 0,
  }

  private nodeRadius = 28

  private targetNodeCount = 0

  private nextUid = 1

  private initialized = false

  private spawnBudget = 0

  private linkRefreshTimer = 0

  private resizeSettleRemaining = 0

  constructor(catalog: readonly NetworkCatalogItem[]) {
    this.catalog = catalog
  }

  public setViewport(width: number, height: number, nodeRadius: number) {
    if (width <= 0 || height <= 0) {
      return
    }

    const previousWidth = this.viewport.width

    const previousHeight = this.viewport.height

    const hadViewport = previousWidth > 0 && previousHeight > 0

    const widthDelta = Math.abs(width - previousWidth)

    const heightDelta = Math.abs(height - previousHeight)

    /**
     * Conservamos la red existente durante resize.
     *
     * No regeneramos posiciones.
     */
    if (hadViewport && (widthDelta > RESIZE_SETTLE_THRESHOLD || heightDelta > RESIZE_SETTLE_THRESHOLD)) {
      const scaleX = width / previousWidth

      const scaleY = height / previousHeight

      for (const node of this.nodes) {
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

    this.nodeRadius = nodeRadius

    const nextTargetNodeCount = this.calculateTargetNodeCount(width, height)

    if (!this.initialized) {
      this.targetNodeCount = nextTargetNodeCount

      this.initialized = true

      for (let index = 0; index < this.targetNodeCount; index += 1) {
        this.spawnNode(false)
      }

      this.refreshLinks()

      return
    }

    /**
     * Evitamos añadir/quitar nodos constantemente
     * durante pequeños cambios de viewport.
     */
    if (Math.abs(nextTargetNodeCount - this.targetNodeCount) >= NODE_COUNT_HYSTERESIS) {
      this.targetNodeCount = nextTargetNodeCount

      this.reconcilePopulation()
    }
  }

  public step(deltaSeconds: number, timeSeconds: number, reducedMotion: boolean) {
    if (!this.initialized) {
      return
    }

    const delta = clamp(deltaSeconds, 0, 0.04)

    this.resizeSettleRemaining = Math.max(
      0,

      this.resizeSettleRemaining - delta,
    )

    this.updatePopulation(delta)

    this.updateAlpha(delta)

    if (!reducedMotion) {
      this.updateWander(delta, timeSeconds)

      this.applyPairForces(delta)

      this.applyBounds(delta)

      this.integrate(delta)
    }

    this.linkRefreshTimer += delta

    if (this.linkRefreshTimer >= LINK_REFRESH_INTERVAL) {
      this.linkRefreshTimer = 0

      this.refreshLinks()
    }

    this.updateLinks(delta)
  }

  public getNodes(): readonly NetworkNode[] {
    return this.nodes
  }

  public getLinks(): IterableIterator<NetworkLink> {
    return this.links.values()
  }

  public getNode(uid: number) {
    return this.nodesByUid.get(uid)
  }

  public getLinkRadius() {
    const { width, height } = this.viewport

    return clamp(
      Math.min(width, height) * 0.285,

      MIN_LINK_RADIUS,
      MAX_LINK_RADIUS,
    )
  }

  public hitTest(point: Point, baseRadius: number): NetworkNode | null {
    let selected: NetworkNode | null = null

    let selectedDistance = Number.POSITIVE_INFINITY

    for (const node of this.nodes) {
      if (node.alpha < 0.35) {
        continue
      }

      const currentDistance = Math.hypot(
        point.x - node.x,

        point.y - node.y,
      )

      const radius = baseRadius * node.sizeScale * 1.35

      if (currentDistance <= radius && currentDistance < selectedDistance) {
        selected = node

        selectedDistance = currentDistance
      }
    }

    return selected
  }

  private calculateTargetNodeCount(width: number, height: number) {
    return Math.round(
      clamp(
        (width * height) / NODE_AREA_PIXELS,

        MIN_NODE_COUNT,
        MAX_NODE_COUNT,
      ),
    )
  }

  private getHorizontalOverscan() {
    return Math.max(
      MIN_HORIZONTAL_OVERSCAN,

      this.viewport.width * HORIZONTAL_OVERSCAN_RATIO,
    )
  }

  private getVerticalOverscan() {
    return Math.max(
      MIN_VERTICAL_OVERSCAN,

      this.viewport.height * VERTICAL_OVERSCAN_RATIO,
    )
  }

  private getCenterZone() {
    return {
      radiusX: clamp(
        this.viewport.width * CENTER_RADIUS_X_RATIO,

        CENTER_RADIUS_X_MIN,
        CENTER_RADIUS_X_MAX,
      ),

      radiusY: clamp(
        this.viewport.height * CENTER_RADIUS_Y_RATIO,

        CENTER_RADIUS_Y_MIN,
        CENTER_RADIUS_Y_MAX,
      ),
    }
  }

  private isInsideCenterZone(x: number, y: number) {
    const { width, height } = this.viewport

    const { radiusX, radiusY } = this.getCenterZone()

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
    if (this.catalog.length === 0) {
      throw new Error('ItemNetworkBackground requires at least one item.')
    }

    return this.catalog[Math.floor(Math.random() * this.catalog.length)]
  }

  /**
   * Genera varias posiciones y escoge la que cubra mejor
   * una región poco ocupada.
   */
  private createHomePosition(): Point {
    const horizontalOverscan = this.getHorizontalOverscan()

    const verticalOverscan = this.getVerticalOverscan()

    let bestPoint: Point | null = null

    let bestScore = Number.NEGATIVE_INFINITY

    for (let attempt = 0; attempt < NODE_PLACEMENT_CANDIDATES; attempt += 1) {
      const point: Point = {
        x: randomBetween(
          -horizontalOverscan * 0.48,

          this.viewport.width + horizontalOverscan * 0.48,
        ),

        y: randomBetween(
          -verticalOverscan * 0.45,

          this.viewport.height + verticalOverscan * 0.45,
        ),
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

        minimumDistanceSquared = Math.min(
          minimumDistanceSquared,

          distanceSquared(point, node),
        )
      }

      /**
       * Los candidatos visibles reciben una ligera ventaja,
       * sin impedir nodos parcialmente fuera del viewport.
       */
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

    /**
     * Fallback extremadamente raro:
     * todos los candidatos estaban dentro de la zona central.
     */
    return {
      x: randomBetween(0, this.viewport.width),

      y: randomBetween(0, this.viewport.height),
    }
  }

  private spawnNode(fadeIn: boolean) {
    const item = this.pickCatalogItem()

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

    this.removeLinksForNode(node.uid)
  }

  private removeLinksForNode(uid: number) {
    for (const [id, link] of this.links) {
      if (link.sourceUid === uid || link.targetUid === uid) {
        this.links.delete(id)
      }
    }
  }

  private reconcilePopulation() {
    const activeNodes = this.nodes.filter((node) => !node.retiring)

    if (activeNodes.length > this.targetNodeCount) {
      const excess = activeNodes.length - this.targetNodeCount

      const centerX = this.viewport.width / 2

      const centerY = this.viewport.height / 2

      /**
       * Retiramos primero los más alejados del área central.
       */
      const candidates = [...activeNodes].sort((first, second) => {
        const firstDistance = Math.hypot(
          first.x - centerX,

          first.y - centerY,
        )

        const secondDistance = Math.hypot(
          second.x - centerX,

          second.y - centerY,
        )

        return secondDistance - firstDistance
      })

      for (let index = 0; index < excess; index += 1) {
        candidates[index].retiring = true

        candidates[index].targetAlpha = 0
      }
    }

    if (activeNodes.length < this.targetNodeCount) {
      let missing = this.targetNodeCount - activeNodes.length

      /**
       * Recuperamos primero nodos que estuvieran retirándose.
       */
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

  private updatePopulation(delta: number) {
    const activeCount = this.nodes.reduce(
      (total, node) => total + (node.retiring ? 0 : 1),

      0,
    )

    if (activeCount < this.targetNodeCount) {
      this.spawnBudget += delta * NODE_SPAWN_RATE

      const missing = this.targetNodeCount - activeCount

      const amount = Math.min(
        missing,

        Math.floor(this.spawnBudget),
      )

      if (amount > 0) {
        this.spawnBudget -= amount

        for (let index = 0; index < amount; index += 1) {
          this.spawnNode(true)
        }
      }
    } else {
      this.spawnBudget = 0
    }

    const removable = this.nodes.filter((node) => node.retiring && node.alpha < 0.015)

    for (const node of removable) {
      this.removeNode(node)
    }
  }

  private updateAlpha(delta: number) {
    const response = Math.min(
      1,

      delta * NODE_FADE_SPEED,
    )

    for (const node of this.nodes) {
      node.alpha += (node.targetAlpha - node.alpha) * response
    }
  }

  /**
   * Tres escalas de movimiento:
   *
   * 1. campo compartido;
   * 2. roaming amplio;
   * 3. micro movimiento individual.
   */
  private updateWander(delta: number, time: number) {
    const { width, height } = this.viewport

    const centerX = width / 2

    const centerY = height / 2

    const {
      radiusX: safeRadiusX,

      radiusY: safeRadiusY,
    } = this.getCenterZone()

    const springStrength = ORBIT_SPRING_STRENGTH * (this.resizeSettleRemaining > 0 ? RESIZE_SPRING_MULTIPLIER : 1)

    for (const node of this.nodes) {
      const homeX = node.homeXRatio * width

      const homeY = node.homeYRatio * height

      /**
       * Campo compartido.
       */
      const fieldX =
        (Math.sin(time * FIELD_SPEED_X + homeY * 0.0034) * 0.66 +
          Math.cos(time * FIELD_SPEED_X * 0.58 + homeX * 0.0026 + homeY * 0.001) * 0.34) *
        FIELD_AMPLITUDE_X

      const fieldY =
        (Math.cos(time * FIELD_SPEED_Y + homeX * 0.0031) * 0.69 +
          Math.sin(time * FIELD_SPEED_Y * 0.63 + homeY * 0.0027 - homeX * 0.0009) * 0.31) *
        FIELD_AMPLITUDE_Y

      /**
       * Roaming lento.
       *
       * Las dos frecuencias evitan una órbita elíptica evidente.
       */
      const roamX =
        (Math.sin(time * node.roamSpeed + node.roamPhase) * 0.72 +
          Math.sin(time * node.roamSpeed * 0.43 + node.roamSecondaryPhase) * 0.28) *
        node.roamRadiusX

      const roamY =
        (Math.cos(time * node.roamSpeed * 0.83 + node.roamPhase) * 0.7 +
          Math.cos(time * node.roamSpeed * 0.37 + node.roamSecondaryPhase) * 0.3) *
        node.roamRadiusY

      /**
       * Movimiento individual.
       */
      const orbitX = Math.sin(time * node.orbitSpeed + node.phase) * node.orbitRadiusX

      const orbitY = Math.cos(time * node.orbitSpeed * 0.86 + node.phase) * node.orbitRadiusY

      const secondaryX = Math.sin(time * node.orbitSpeed * 0.39 + node.secondaryPhase) * SECONDARY_WANDER_STRENGTH

      const secondaryY = Math.cos(time * node.orbitSpeed * 0.44 + node.secondaryPhase) * SECONDARY_WANDER_STRENGTH

      const targetX = homeX + fieldX + roamX + orbitX + secondaryX

      const targetY = homeY + fieldY + roamY + orbitY + secondaryY

      node.vx += (targetX - node.x) * springStrength * delta

      node.vy += (targetY - node.y) * springStrength * delta

      /**
       * Evitación elíptica de la zona central.
       */
      const dx = node.x - centerX

      const dy = node.y - centerY

      const normalized = (dx * dx) / (safeRadiusX * safeRadiusX) + (dy * dy) / (safeRadiusY * safeRadiusY)

      if (normalized < 1) {
        const influence = 1 - normalized

        const length = Math.hypot(dx, dy)

        if (length > 0.001) {
          node.vx += (dx / length) * CENTER_AVOIDANCE_ACCELERATION * influence * delta

          node.vy += (dy / length) * CENTER_AVOIDANCE_ACCELERATION * influence * delta
        }
      }
    }
  }

  /**
   * Repulsión local.
   *
   * No intentamos simular una física completa.
   */
  private applyPairForces(delta: number) {
    for (let firstIndex = 0; firstIndex < this.nodes.length; firstIndex += 1) {
      const first = this.nodes[firstIndex]

      for (let secondIndex = firstIndex + 1; secondIndex < this.nodes.length; secondIndex += 1) {
        const second = this.nodes[secondIndex]

        const dx = second.x - first.x

        const dy = second.y - first.y

        const firstRadius = this.nodeRadius * first.sizeScale

        const secondRadius = this.nodeRadius * second.sizeScale

        const collisionDistance = (firstRadius + secondRadius) * COLLISION_DISTANCE_FACTOR

        const repulsionDistance = collisionDistance * SOFT_REPULSION_DISTANCE_FACTOR

        const currentDistanceSquared = dx * dx + dy * dy

        if (currentDistanceSquared <= 0.001 || currentDistanceSquared > repulsionDistance * repulsionDistance) {
          continue
        }

        const currentDistance = Math.sqrt(currentDistanceSquared)

        const normalX = dx / currentDistance

        const normalY = dy / currentDistance

        let acceleration = 0

        if (currentDistance < collisionDistance) {
          const overlap = 1 - currentDistance / collisionDistance

          acceleration = COLLISION_ACCELERATION * overlap
        } else {
          const proximity = 1 - (currentDistance - collisionDistance) / (repulsionDistance - collisionDistance)

          acceleration = SOFT_REPULSION_ACCELERATION * proximity * proximity
        }

        const impulse = acceleration * delta

        first.vx -= normalX * impulse

        first.vy -= normalY * impulse

        second.vx += normalX * impulse

        second.vy += normalY * impulse
      }
    }
  }

  /**
   * Límites blandos.
   *
   * El nodo puede salir parcialmente del viewport sin rebotar.
   */
  private applyBounds(delta: number) {
    const horizontalOverscan = this.getHorizontalOverscan()

    const verticalOverscan = this.getVerticalOverscan()

    const left = -horizontalOverscan

    const right = this.viewport.width + horizontalOverscan

    const top = -verticalOverscan

    const bottom = this.viewport.height + verticalOverscan

    for (const node of this.nodes) {
      if (node.x < left) {
        node.vx += (left - node.x) * BOUNDARY_SPRING_STRENGTH * delta
      }

      if (node.x > right) {
        node.vx -= (node.x - right) * BOUNDARY_SPRING_STRENGTH * delta
      }

      if (node.y < top) {
        node.vy += (top - node.y) * BOUNDARY_SPRING_STRENGTH * delta
      }

      if (node.y > bottom) {
        node.vy -= (node.y - bottom) * BOUNDARY_SPRING_STRENGTH * delta
      }
    }
  }

  private integrate(delta: number) {
    const baseDamping = this.resizeSettleRemaining > 0 ? RESIZE_VELOCITY_DAMPING : VELOCITY_DAMPING

    const damping = Math.pow(baseDamping, delta * 60)

    for (const node of this.nodes) {
      node.vx *= damping

      node.vy *= damping

      const speed = Math.hypot(node.vx, node.vy)

      if (speed > MAX_NODE_SPEED) {
        const ratio = MAX_NODE_SPEED / speed

        node.vx *= ratio

        node.vy *= ratio
      }

      node.x += node.vx * delta

      node.y += node.vy * delta
    }
  }

  /**
   * Recalcula la topología según proximidad.
   */
  private refreshLinks() {
    const linkRadius = this.getLinkRadius()

    const connectRadius = linkRadius * LINK_CONNECT_THRESHOLD

    const disconnectRadius = linkRadius * LINK_DISCONNECT_THRESHOLD

    const candidates: CandidateLink[] = []

    for (let firstIndex = 0; firstIndex < this.nodes.length; firstIndex += 1) {
      const source = this.nodes[firstIndex]

      if (source.alpha < 0.08) {
        continue
      }

      for (let secondIndex = firstIndex + 1; secondIndex < this.nodes.length; secondIndex += 1) {
        const target = this.nodes[secondIndex]

        if (target.alpha < 0.08) {
          continue
        }

        const currentDistance = Math.hypot(
          target.x - source.x,

          target.y - source.y,
        )

        const minimumUid = Math.min(source.uid, target.uid)

        const maximumUid = Math.max(source.uid, target.uid)

        const id = `${minimumUid}:${maximumUid}`

        const existing = this.links.has(id)

        const threshold = existing ? disconnectRadius : connectRadius

        if (currentDistance > threshold) {
          continue
        }

        const seed = hashString(id)

        const persistenceBonus = existing ? -LINK_PERSISTENCE_BONUS : 0

        candidates.push({
          id,
          source,
          target,

          distance: currentDistance,

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

    /**
     * Conexiones antiguas no seleccionadas comienzan fade-out.
     */
    for (const [id, link] of this.links) {
      link.targetAlpha = desired.has(id) ? 1 : 0
    }

    /**
     * Creamos las nuevas.
     */
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

  private updateLinks(delta: number) {
    const response = Math.min(
      1,

      delta * LINK_FADE_SPEED,
    )

    for (const [id, link] of this.links) {
      link.alpha += (link.targetAlpha - link.alpha) * response

      if (link.targetAlpha === 0 && link.alpha < 0.012) {
        this.links.delete(id)
      }
    }
  }
}
