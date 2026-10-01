import {
  BOUNDARY_SPRING_STRENGTH,
  CENTER_AVOIDANCE_ACCELERATION,
  COLLISION_ACCELERATION,
  COLLISION_DISTANCE_FACTOR,
  FIELD_AMPLITUDE_X,
  FIELD_AMPLITUDE_Y,
  FIELD_SPEED_X,
  FIELD_SPEED_Y,
  MAX_NODE_SPEED,
  ORBIT_SPRING_STRENGTH,
  RESIZE_SPRING_MULTIPLIER,
  RESIZE_VELOCITY_DAMPING,
  SECONDARY_WANDER_STRENGTH,
  SOFT_REPULSION_ACCELERATION,
  SOFT_REPULSION_DISTANCE_FACTOR,
  VELOCITY_DAMPING,
} from '../network.config'
import { getCenterZone, getHorizontalOverscan, getVerticalOverscan } from '../lib/math'
import type { NetworkNode, NetworkViewport } from '../network.types'

// Ambient forces mutate nodes in place, never React state or link geometry.
export const updateWander = (
  nodes: readonly NetworkNode[],
  viewport: NetworkViewport,
  resizeSettleRemaining: number,
  delta: number,
  time: number,
) => {
  const { width, height } = viewport
  const centerX = width / 2
  const centerY = height / 2
  const { radiusX: safeRadiusX, radiusY: safeRadiusY } = getCenterZone(viewport.width, viewport.height)
  const springStrength = ORBIT_SPRING_STRENGTH * (resizeSettleRemaining > 0 ? RESIZE_SPRING_MULTIPLIER : 1)
  for (const node of nodes) {
    const homeX = node.homeXRatio * width
    const homeY = node.homeYRatio * height
    const fieldX =
      (Math.sin(time * FIELD_SPEED_X + homeY * 0.0034) * 0.66 +
        Math.cos(time * FIELD_SPEED_X * 0.58 + homeX * 0.0026 + homeY * 0.001) * 0.34) *
      FIELD_AMPLITUDE_X
    const fieldY =
      (Math.cos(time * FIELD_SPEED_Y + homeX * 0.0031) * 0.69 +
        Math.sin(time * FIELD_SPEED_Y * 0.63 + homeY * 0.0027 - homeX * 0.0009) * 0.31) *
      FIELD_AMPLITUDE_Y
    const roamX =
      (Math.sin(time * node.roamSpeed + node.roamPhase) * 0.72 + Math.sin(time * node.roamSpeed * 0.43 + node.roamSecondaryPhase) * 0.28) *
      node.roamRadiusX
    const roamY =
      (Math.cos(time * node.roamSpeed * 0.83 + node.roamPhase) * 0.7 +
        Math.cos(time * node.roamSpeed * 0.37 + node.roamSecondaryPhase) * 0.3) *
      node.roamRadiusY
    const orbitX = Math.sin(time * node.orbitSpeed + node.phase) * node.orbitRadiusX
    const orbitY = Math.cos(time * node.orbitSpeed * 0.86 + node.phase) * node.orbitRadiusY
    const secondaryX = Math.sin(time * node.orbitSpeed * 0.39 + node.secondaryPhase) * SECONDARY_WANDER_STRENGTH
    const secondaryY = Math.cos(time * node.orbitSpeed * 0.44 + node.secondaryPhase) * SECONDARY_WANDER_STRENGTH
    const targetX = homeX + fieldX + roamX + orbitX + secondaryX
    const targetY = homeY + fieldY + roamY + orbitY + secondaryY
    node.vx += (targetX - node.x) * springStrength * delta
    node.vy += (targetY - node.y) * springStrength * delta
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

export const applyPairForces = (nodes: readonly NetworkNode[], nodeRadius: number, delta: number) => {
  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    const first = nodes[firstIndex]
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      const second = nodes[secondIndex]
      const dx = second.x - first.x
      const dy = second.y - first.y
      const firstRadius = nodeRadius * first.sizeScale
      const secondRadius = nodeRadius * second.sizeScale
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

export const applyBounds = (nodes: readonly NetworkNode[], viewport: NetworkViewport, delta: number) => {
  const horizontalOverscan = getHorizontalOverscan(viewport.width)
  const verticalOverscan = getVerticalOverscan(viewport.height)
  const left = -horizontalOverscan
  const right = viewport.width + horizontalOverscan
  const top = -verticalOverscan
  const bottom = viewport.height + verticalOverscan
  for (const node of nodes) {
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

export const integrate = (nodes: readonly NetworkNode[], resizeSettleRemaining: number, delta: number) => {
  const baseDamping = resizeSettleRemaining > 0 ? RESIZE_VELOCITY_DAMPING : VELOCITY_DAMPING
  const damping = Math.pow(baseDamping, delta * 60)
  for (const node of nodes) {
    node.vx *= damping
    node.vy *= damping
    const speedSquared = node.vx * node.vx + node.vy * node.vy
    if (speedSquared > MAX_NODE_SPEED * MAX_NODE_SPEED) {
      const ratio = MAX_NODE_SPEED / Math.sqrt(speedSquared)
      node.vx *= ratio
      node.vy *= ratio
    }
    node.x += node.vx * delta
    node.y += node.vy * delta
  }
}
