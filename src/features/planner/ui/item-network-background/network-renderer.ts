import {
  CENTER_LINK_ALPHA,
  CENTER_RADIUS_X_MAX,
  CENTER_RADIUS_X_MIN,
  CENTER_RADIUS_X_RATIO,
  CENTER_RADIUS_Y_MAX,
  CENTER_RADIUS_Y_MIN,
  CENTER_RADIUS_Y_RATIO,
  DEFAULT_NETWORK_PALETTE,
  IMPACT_BEAD_ALPHA,
  IMPACT_BEAD_DECAY_POWER,
  IMPACT_BEAD_HOLD_LEVEL,
  IMPACT_BEAD_RADIUS,
  IMPACT_CORONA_ALPHA,
  IMPACT_CORONA_ARC_SPAN,
  IMPACT_CORONA_BLUR,
  IMPACT_CORONA_DECAY_POWER,
  IMPACT_CORONA_EXPANSION,
  IMPACT_CORONA_FALLOFF,
  IMPACT_CORONA_HOLD_LEVEL,
  IMPACT_DURATION_SECONDS,
  IMPACT_GLINT_DECAY_POWER,
  IMPACT_GLINT_HOLD_LEVEL,
  IMPACT_GLINT_LENGTH,
  IMPACT_HOLD_END,
  IMPACT_LIMB_ALPHA,
  IMPACT_LIMB_ARC_SPAN,
  IMPACT_LIMB_BLUR,
  IMPACT_LIMB_DECAY_POWER,
  IMPACT_LIMB_FALLOFF,
  IMPACT_LIMB_HOLD_LEVEL,
  IMPACT_PEAK,
  IMPACT_SETTLE_END,
  MAX_POINTER_RADIUS,
  MIN_POINTER_RADIUS,
  SIGNAL_EASING_STRENGTH,
  SIGNAL_RESTART_GAP_SECONDS,
  SIGNAL_TRAIL_LENGTH,
} from './network.config'

import type { NetworkNode, NetworkPalette, Point, RGB } from './network.types'

import type { NetworkEngine } from './network-engine'

type NetworkRenderOptions = {
  context: CanvasRenderingContext2D

  engine: NetworkEngine

  width: number
  height: number

  time: number

  nodeRadius: number

  pointer: Point | null
  hoveredUid: number | null

  palette: NetworkPalette

  reducedMotion: boolean

  getImage: (itemId: string) => HTMLImageElement | null
}

type CinematicImpactEnvelope = {
  corona: number
  limb: number
  bead: number
  glint: number
}

type NodeImpact = {
  source: NetworkNode
  target: NetworkNode

  /**
   * Opacidad estructural derivada del link y ambos nodos.
   */
  baseAlpha: number

  /**
   * Progreso normalizado 0 → 1 de la animación completa.
   */
  progress: number

  /**
   * Se utiliza únicamente para resolver dos impactos simultáneos
   * sobre un mismo nodo.
   */
  strength: number
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount

const rgba = (color: RGB, alpha: number) =>
  `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${clamp(alpha, 0, 1)})`

const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1)

  return t * t * (3 - 2 * t)
}

const smootherstep = (value: number) => {
  const t = clamp(value, 0, 1)

  return t * t * t * (t * (t * 6 - 15) + 10)
}

const mixRgb = (first: RGB, second: RGB, amount: number): RGB => {
  const t = clamp(amount, 0, 1)

  return {
    r: lerp(first.r, second.r, t),

    g: lerp(first.g, second.g, t),

    b: lerp(first.b, second.b, t),
  }
}

const distance = (first: Point, second: Point) =>
  Math.hypot(
    second.x - first.x,

    second.y - first.y,
  )

const getPointerRadius = (width: number, height: number) =>
  clamp(
    Math.min(width, height) * 0.27,

    MIN_POINTER_RADIUS,
    MAX_POINTER_RADIUS,
  )

const getPointInfluence = (point: Point, pointer: Point | null, radius: number) => {
  if (!pointer) {
    return 0
  }

  return smoothstep(
    1 -
      clamp(
        distance(point, pointer) / radius,

        0,
        1,
      ),
  )
}

const getDistanceToSegment = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x

  const dy = end.y - start.y

  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return distance(point, start)
  }

  const projection = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,

    0,
    1,
  )

  return distance(point, {
    x: start.x + dx * projection,

    y: start.y + dy * projection,
  })
}

const getSegmentInfluence = (start: Point, end: Point, pointer: Point | null, radius: number) => {
  if (!pointer) {
    return 0
  }

  return smoothstep(
    1 -
      clamp(
        getDistanceToSegment(pointer, start, end) / radius,

        0,
        1,
      ),
  )
}

const getNodeColor = (node: NetworkNode, palette: NetworkPalette) => {
  switch (node.itemType) {
    case 'raw':
      return palette.raw

    case 'processed':
      return palette.processed

    case 'component':
    default:
      return palette.component
  }
}

/**
 * Movimiento de la señal.
 *
 * Mezclamos movimiento lineal y smootherstep para evitar
 * una velocidad completamente mecánica sin introducir
 * una aceleración exagerada.
 */
const getSignalTravelProgress = (progress: number) => {
  const smooth = smootherstep(progress)

  return lerp(progress, smooth, SIGNAL_EASING_STRENGTH)
}

/**
 * La propia partícula conserva presencia hasta el contacto.
 */
const getSignalAlpha = (progress: number) => {
  const fadeIn = smootherstep(
    clamp(
      progress / 0.055,

      0,
      1,
    ),
  )

  /**
   * Sólo reducimos ligeramente el pulso al final.
   *
   * El impacto toma el relevo justo al tocar el borde.
   */
  const arrivalBlend = smootherstep(
    clamp(
      (progress - 0.94) / 0.06,

      0,
      1,
    ),
  )

  return fadeIn * (1 - arrivalBlend * 0.38)
}

/**
 * Decay independiente de una capa del impacto.
 */
const getImpactDecay = (decayProgress: number, holdLevel: number, power: number) => {
  const remaining = 1 - smootherstep(decayProgress)

  return holdLevel * Math.pow(remaining, power)
}

/**
 * Timeline cinematográfica completa.
 *
 * Las capas comparten:
 *
 * FLASH -> SETTLE -> HOLD -> DECAY
 *
 * pero cada una mantiene y pierde energía a distinta velocidad.
 */
const getCinematicImpactEnvelope = (progress: number): CinematicImpactEnvelope => {
  const t = clamp(progress, 0, 1)

  /**
   * -----------------------------------------------------------
   * FLASH
   * -----------------------------------------------------------
   *
   * Todas las capas alcanzan su máximo prácticamente a la vez.
   */
  if (t <= IMPACT_PEAK) {
    const attack = smootherstep(t / IMPACT_PEAK)

    return {
      corona: attack,

      limb: attack,

      bead: attack,

      glint: attack,
    }
  }

  /**
   * -----------------------------------------------------------
   * SETTLE
   * -----------------------------------------------------------
   *
   * El flash inicial baja ligeramente hasta la intensidad
   * estable de cada capa.
   */
  if (t <= IMPACT_SETTLE_END) {
    const settle = smootherstep((t - IMPACT_PEAK) / (IMPACT_SETTLE_END - IMPACT_PEAK))

    return {
      corona: lerp(1, IMPACT_CORONA_HOLD_LEVEL, settle),

      limb: lerp(1, IMPACT_LIMB_HOLD_LEVEL, settle),

      bead: lerp(1, IMPACT_BEAD_HOLD_LEVEL, settle),

      glint: lerp(1, IMPACT_GLINT_HOLD_LEVEL, settle),
    }
  }

  /**
   * -----------------------------------------------------------
   * HOLD
   * -----------------------------------------------------------
   */
  if (t <= IMPACT_HOLD_END) {
    return {
      corona: IMPACT_CORONA_HOLD_LEVEL,

      limb: IMPACT_LIMB_HOLD_LEVEL,

      bead: IMPACT_BEAD_HOLD_LEVEL,

      glint: IMPACT_GLINT_HOLD_LEVEL,
    }
  }

  /**
   * -----------------------------------------------------------
   * DECAY
   * -----------------------------------------------------------
   */
  const decay = clamp(
    (t - IMPACT_HOLD_END) / (1 - IMPACT_HOLD_END),

    0,
    1,
  )

  return {
    corona: getImpactDecay(decay, IMPACT_CORONA_HOLD_LEVEL, IMPACT_CORONA_DECAY_POWER),

    limb: getImpactDecay(decay, IMPACT_LIMB_HOLD_LEVEL, IMPACT_LIMB_DECAY_POWER),

    bead: getImpactDecay(decay, IMPACT_BEAD_HOLD_LEVEL, IMPACT_BEAD_DECAY_POWER),

    glint: getImpactDecay(decay, IMPACT_GLINT_HOLD_LEVEL, IMPACT_GLINT_DECAY_POWER),
  }
}

const getCenterLinkVisibility = (start: Point, end: Point, width: number, height: number) => {
  const center = {
    x: width / 2,

    y: height / 2,
  }

  const radiusX = clamp(
    width * CENTER_RADIUS_X_RATIO,

    CENTER_RADIUS_X_MIN,
    CENTER_RADIUS_X_MAX,
  )

  const radiusY = clamp(
    height * CENTER_RADIUS_Y_RATIO,

    CENTER_RADIUS_Y_MIN,
    CENTER_RADIUS_Y_MAX,
  )

  const yScale = radiusX / radiusY

  const scaledCenter = {
    x: center.x,

    y: center.y * yScale,
  }

  const scaledStart = {
    x: start.x,

    y: start.y * yScale,
  }

  const scaledEnd = {
    x: end.x,

    y: end.y * yScale,
  }

  const centerDistance = getDistanceToSegment(scaledCenter, scaledStart, scaledEnd)

  if (centerDistance >= radiusX) {
    return 1
  }

  const normalized = clamp(
    centerDistance / radiusX,

    0,
    1,
  )

  return CENTER_LINK_ALPHA + (1 - CENTER_LINK_ALPHA) * smoothstep(normalized)
}

const parseComputedColor = (value: string): RGB | null => {
  const matches = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)

  if (!matches) {
    return null
  }

  return {
    r: Number(matches[1]),

    g: Number(matches[2]),

    b: Number(matches[3]),
  }
}

/**
 * Dibuja un arco cuya intensidad cae progresivamente
 * desde el punto central hacia ambos extremos.
 */
const drawTaperedArc = ({
  context,
  x,
  y,
  radius,
  centerAngle,
  span,
  segments = 32,
  lineWidth,
  color,
  peakAlpha,
  falloff,
}: {
  context: CanvasRenderingContext2D

  x: number
  y: number

  radius: number

  centerAngle: number
  span: number

  segments?: number

  lineWidth: number

  color: RGB
  peakAlpha: number

  falloff: number
}) => {
  const halfSpan = span / 2

  for (let index = 0; index < segments; index += 1) {
    const t0 = index / segments

    const t1 = (index + 1) / segments

    const middle = (t0 + t1) / 2

    const distanceFromCenter = Math.abs(middle - 0.5) / 0.5

    const cosineEnvelope = Math.cos((Math.min(1, distanceFromCenter) * Math.PI) / 2)

    const envelope = Math.pow(
      Math.max(0, cosineEnvelope),

      falloff,
    )

    if (envelope < 0.002) {
      continue
    }

    /**
     * Pequeño solapamiento para eliminar micro-separaciones
     * visibles entre segmentos.
     */
    const overlap = (span / segments) * 0.1

    context.beginPath()

    context.arc(
      x,
      y,
      radius,

      centerAngle - halfSpan + t0 * span - overlap,

      centerAngle - halfSpan + t1 * span + overlap,
    )

    context.strokeStyle = rgba(
      color,

      peakAlpha * envelope,
    )

    context.lineWidth = lineWidth * (0.72 + envelope * 0.28)

    context.stroke()
  }
}

export const readNetworkPalette = (container: HTMLElement): NetworkPalette => {
  const probe = document.createElement('span')

  probe.style.position = 'absolute'

  probe.style.visibility = 'hidden'

  probe.style.pointerEvents = 'none'

  container.appendChild(probe)

  const resolveColor = (expression: string, fallback: RGB) => {
    probe.style.color = ''
    probe.style.color = expression

    return parseComputedColor(getComputedStyle(probe).color) ?? fallback
  }

  const palette: NetworkPalette = {
    primary: resolveColor('hsl(var(--heroui-primary))', DEFAULT_NETWORK_PALETTE.primary),

    secondary: resolveColor('hsl(var(--heroui-secondary))', DEFAULT_NETWORK_PALETTE.secondary),

    divider: resolveColor('hsl(var(--heroui-divider))', DEFAULT_NETWORK_PALETTE.divider),

    content: resolveColor('hsl(var(--heroui-content1))', DEFAULT_NETWORK_PALETTE.content),

    raw: resolveColor('var(--color-item-raw)', DEFAULT_NETWORK_PALETTE.raw),

    processed: resolveColor('var(--color-item-processed)', DEFAULT_NETWORK_PALETTE.processed),

    component: resolveColor('var(--color-item-component)', DEFAULT_NETWORK_PALETTE.component),
  }

  probe.remove()

  return palette
}

export const renderNetwork = ({
  context,
  engine,
  width,
  height,
  time,
  nodeRadius,
  pointer,
  hoveredUid,
  palette,
  reducedMotion,
  getImage,
}: NetworkRenderOptions) => {
  const pointerRadius = getPointerRadius(width, height)

  const linkRadius = engine.getLinkRadius()

  const impacts = new Map<number, NodeImpact>()

  context.lineCap = 'round'

  /**
   * =============================================================
   * CONEXIONES + TRANSFERENCIAS
   * =============================================================
   */
  for (const link of engine.getLinks()) {
    if (link.alpha < 0.01) {
      continue
    }

    const source = engine.getNode(link.sourceUid)

    const target = engine.getNode(link.targetUid)

    if (!source || !target) {
      continue
    }

    const dx = target.x - source.x

    const dy = target.y - source.y

    const centerDistance = Math.max(
      Math.hypot(dx, dy),

      0.001,
    )

    const directionX = dx / centerDistance

    const directionY = dy / centerDistance

    const sourceRadius = nodeRadius * source.sizeScale

    const targetRadius = nodeRadius * target.sizeScale

    /**
     * La señal viaja de borde a borde.
     */
    const startX = source.x + directionX * sourceRadius

    const startY = source.y + directionY * sourceRadius

    const endX = target.x - directionX * targetRadius

    const endY = target.y - directionY * targetRadius

    const sourcePoint = {
      x: source.x,

      y: source.y,
    }

    const targetPoint = {
      x: target.x,

      y: target.y,
    }

    const proximity =
      1 -
      clamp(
        centerDistance / linkRadius,

        0,
        1,
      )

    const pointerInfluence = getSegmentInfluence(sourcePoint, targetPoint, pointer, pointerRadius)

    const hovered = hoveredUid === source.uid || hoveredUid === target.uid

    const centerVisibility = getCenterLinkVisibility(sourcePoint, targetPoint, width, height)

    const combinedAlpha = link.alpha * source.alpha * target.alpha

    /**
     * -----------------------------------------------------------
     * CONEXIÓN BASE
     * -----------------------------------------------------------
     */
    const lineAlpha = combinedAlpha * centerVisibility * (0.065 + proximity * 0.14 + pointerInfluence * 0.1 + (hovered ? 0.16 : 0))

    const lineWidth = 0.95 + proximity * 0.9 + pointerInfluence * 0.36 + (hovered ? 0.38 : 0)

    context.beginPath()

    context.moveTo(source.x, source.y)

    context.lineTo(target.x, target.y)

    context.strokeStyle = hovered ? rgba(palette.primary, lineAlpha * 1.3) : rgba(palette.secondary, lineAlpha)

    context.lineWidth = lineWidth

    context.stroke()

    if (reducedMotion || !link.signal || combinedAlpha < 0.12) {
      continue
    }

    /**
     * ===========================================================
     * TIMELINE ÚNICA
     * ===========================================================
     *
     * TRAVEL -> IMPACT -> GAP -> TRAVEL
     */
    const cycleProgress = (time * link.signalSpeed + link.signalPhase) % 1

    /**
     * Convertimos segundos reales a una fracción
     * del ciclo de esta conexión.
     *
     * Con las velocidades actuales, 3.6 s quedan dentro
     * de este rango y no se recortan.
     */
    const impactFraction = clamp(
      IMPACT_DURATION_SECONDS * link.signalSpeed,

      0.12,
      0.48,
    )

    const gapFraction = clamp(
      SIGNAL_RESTART_GAP_SECONDS * link.signalSpeed,

      0.012,
      0.032,
    )

    const travelEnd = 1 - impactFraction - gapFraction

    const impactEnd = 1 - gapFraction

    /**
     * -----------------------------------------------------------
     * VIAJE
     * -----------------------------------------------------------
     */
    if (cycleProgress < travelEnd) {
      const rawProgress = clamp(
        cycleProgress / travelEnd,

        0,
        1,
      )

      const travelProgress = getSignalTravelProgress(rawProgress)

      const signalAlpha = getSignalAlpha(rawProgress)

      const signalX = lerp(startX, endX, travelProgress)

      const signalY = lerp(startY, endY, travelProgress)

      const signalRadius = 1.65 + proximity * 0.9 + pointerInfluence * 0.55 + (hovered ? 0.3 : 0)

      /**
       * Estela.
       */
      const rawTrailProgress = Math.max(
        0,

        rawProgress - SIGNAL_TRAIL_LENGTH,
      )

      const trailProgress = getSignalTravelProgress(rawTrailProgress)

      const trailX = lerp(startX, endX, trailProgress)

      const trailY = lerp(startY, endY, trailProgress)

      const trailGradient = context.createLinearGradient(trailX, trailY, signalX, signalY)

      trailGradient.addColorStop(
        0,
        rgba(
          palette.primary,

          combinedAlpha * centerVisibility * signalAlpha * 0.008,
        ),
      )

      trailGradient.addColorStop(
        0.56,
        rgba(
          palette.primary,

          combinedAlpha * centerVisibility * signalAlpha * 0.075,
        ),
      )

      trailGradient.addColorStop(
        1,
        rgba(
          palette.primary,

          combinedAlpha * centerVisibility * signalAlpha * 0.3,
        ),
      )

      context.beginPath()

      context.moveTo(trailX, trailY)

      context.lineTo(signalX, signalY)

      context.strokeStyle = trailGradient

      context.lineWidth = 1.05 + proximity * 0.5

      context.stroke()

      /**
       * Halo exterior.
       */
      context.beginPath()

      context.arc(signalX, signalY, signalRadius * 3, 0, Math.PI * 2)

      context.fillStyle = rgba(
        palette.primary,

        combinedAlpha * centerVisibility * signalAlpha * 0.028,
      )

      context.fill()

      /**
       * Halo intermedio.
       */
      context.beginPath()

      context.arc(signalX, signalY, signalRadius * 1.75, 0, Math.PI * 2)

      context.fillStyle = rgba(
        palette.primary,

        combinedAlpha * centerVisibility * signalAlpha * (0.1 + proximity * 0.05),
      )

      context.fill()

      /**
       * Núcleo.
       */
      context.beginPath()

      context.arc(signalX, signalY, signalRadius, 0, Math.PI * 2)

      context.fillStyle = rgba(
        palette.primary,

        combinedAlpha * centerVisibility * signalAlpha * (0.72 + proximity * 0.08),
      )

      context.fill()

      continue
    }

    /**
     * -----------------------------------------------------------
     * IMPACTO
     * -----------------------------------------------------------
     */
    if (cycleProgress < impactEnd) {
      const impactProgress = clamp(
        (cycleProgress - travelEnd) / impactFraction,

        0,
        1,
      )

      const envelope = getCinematicImpactEnvelope(impactProgress)

      const baseAlpha = combinedAlpha * centerVisibility

      const strength = baseAlpha * envelope.limb

      const existing = impacts.get(target.uid)

      if (!existing || strength > existing.strength) {
        impacts.set(target.uid, {
          source,
          target,

          baseAlpha,

          progress: impactProgress,

          strength,
        })
      }
    }
  }

  /**
   * =============================================================
   * CORONA TRASERA
   * =============================================================
   */
  for (const impact of impacts.values()) {
    const { source, target, baseAlpha, progress } = impact

    const envelope = getCinematicImpactEnvelope(progress)

    const intensity = baseAlpha * envelope.corona

    if (intensity <= 0.001) {
      continue
    }

    const targetRadius = nodeRadius * target.sizeScale

    const incomingAngle = Math.atan2(
      source.y - target.y,

      source.x - target.x,
    )

    /**
     * Expansión muy lenta durante toda la cola.
     */
    const expansionProgress = smootherstep(progress)

    const coronaRadius = targetRadius * (1.035 + expansionProgress * IMPACT_CORONA_EXPANSION)

    const warmCorona = mixRgb(
      palette.primary,

      {
        r: 255,
        g: 210,
        b: 126,
      },

      0.18,
    )

    context.save()

    context.globalCompositeOperation = 'lighter'

    context.shadowColor = rgba(
      warmCorona,

      intensity * IMPACT_CORONA_ALPHA,
    )

    context.shadowBlur = IMPACT_CORONA_BLUR

    drawTaperedArc({
      context,

      x: target.x,

      y: target.y,

      radius: coronaRadius,

      centerAngle: incomingAngle,

      span: IMPACT_CORONA_ARC_SPAN,

      segments: 34,

      lineWidth: 2.15 + intensity * 0.8,

      color: warmCorona,

      peakAlpha: intensity * IMPACT_CORONA_ALPHA,

      falloff: IMPACT_CORONA_FALLOFF,
    })

    /**
     * Segunda corona mucho más amplia y tenue.
     */
    context.shadowBlur = IMPACT_CORONA_BLUR * 1.45

    drawTaperedArc({
      context,

      x: target.x,

      y: target.y,

      radius: coronaRadius * 1.06,

      centerAngle: incomingAngle,

      span: IMPACT_CORONA_ARC_SPAN * 1.08,

      segments: 36,

      lineWidth: 1.5,

      color: warmCorona,

      peakAlpha: intensity * IMPACT_CORONA_ALPHA * 0.22,

      falloff: IMPACT_CORONA_FALLOFF,
    })

    context.restore()
  }

  /**
   * =============================================================
   * NODOS
   * =============================================================
   */
  for (const node of engine.getNodes()) {
    if (node.alpha < 0.01) {
      continue
    }

    const cullingMargin = nodeRadius * 3

    if (node.x < -cullingMargin || node.x > width + cullingMargin || node.y < -cullingMargin || node.y > height + cullingMargin) {
      continue
    }

    const pointerInfluence = getPointInfluence(node, pointer, pointerRadius)

    const hovered = hoveredUid === node.uid

    const radius = nodeRadius * node.sizeScale * (1 + pointerInfluence * 0.022 + (hovered ? 0.05 : 0))

    const typeColor = getNodeColor(node, palette)

    const accentColor = hovered ? palette.primary : typeColor

    const alpha = node.alpha

    context.save()

    /**
     * Halo base.
     */
    context.beginPath()

    context.arc(
      node.x,
      node.y,

      radius * (1.24 + pointerInfluence * 0.035),

      0,
      Math.PI * 2,
    )

    context.fillStyle = rgba(
      accentColor,

      alpha * (0.015 + pointerInfluence * 0.04 + (hovered ? 0.05 : 0)),
    )

    context.fill()

    /**
     * Anillo exterior.
     */
    context.beginPath()

    context.arc(node.x, node.y, radius * 1.095, 0, Math.PI * 2)

    context.strokeStyle = rgba(
      accentColor,

      alpha * (0.06 + pointerInfluence * 0.12 + (hovered ? 0.17 : 0)),
    )

    context.lineWidth = 0.8 + pointerInfluence * 0.32

    context.stroke()

    /**
     * Cuerpo oscuro.
     */
    context.beginPath()

    context.arc(node.x, node.y, radius, 0, Math.PI * 2)

    context.fillStyle = rgba(palette.content, alpha * 0.94)

    context.fill()

    /**
     * Borde.
     */
    context.beginPath()

    context.arc(node.x, node.y, radius, 0, Math.PI * 2)

    context.strokeStyle = rgba(
      accentColor,

      alpha * (hovered ? 0.76 : 0.25 + pointerInfluence * 0.17),
    )

    context.lineWidth = hovered ? 1.75 : 1.05 + pointerInfluence * 0.28

    context.stroke()

    /**
     * Icono.
     */
    const image = getImage(node.itemId)

    if (image?.complete && image.naturalWidth > 0) {
      const imageSize = radius * 1.38

      context.globalAlpha = alpha * (0.85 + pointerInfluence * 0.07)

      context.drawImage(
        image,

        node.x - imageSize / 2,

        node.y - imageSize / 2,

        imageSize,
        imageSize,
      )

      context.globalAlpha = 1
    }

    context.restore()
  }

  /**
   * =============================================================
   * IMPACTO DELANTERO
   * =============================================================
   */
  for (const impact of impacts.values()) {
    const { source, target, baseAlpha, progress } = impact

    const envelope = getCinematicImpactEnvelope(progress)

    const limbIntensity = baseAlpha * envelope.limb

    const beadIntensity = baseAlpha * envelope.bead

    const glintIntensity = baseAlpha * envelope.glint

    if (limbIntensity <= 0.001 && beadIntensity <= 0.001) {
      continue
    }

    const targetRadius = nodeRadius * target.sizeScale

    const incomingAngle = Math.atan2(
      source.y - target.y,

      source.x - target.x,
    )

    const directionX = Math.cos(incomingAngle)

    const directionY = Math.sin(incomingAngle)

    const tangentX = -directionY

    const tangentY = directionX

    const contactX = target.x + directionX * targetRadius

    const contactY = target.y + directionY * targetRadius

    const warmColor = mixRgb(
      palette.primary,

      {
        r: 255,
        g: 205,
        b: 112,
      },

      0.22,
    )

    const hotColor = mixRgb(
      palette.primary,

      {
        r: 255,
        g: 246,
        b: 218,
      },

      0.58,
    )

    context.save()

    context.globalCompositeOperation = 'lighter'

    /**
     * -----------------------------------------------------------
     * LIMBO
     * -----------------------------------------------------------
     */
    context.shadowColor = rgba(
      warmColor,

      limbIntensity * IMPACT_LIMB_ALPHA,
    )

    context.shadowBlur = IMPACT_LIMB_BLUR

    drawTaperedArc({
      context,

      x: target.x,

      y: target.y,

      radius: targetRadius * (1.008 + smootherstep(progress) * 0.014),

      centerAngle: incomingAngle,

      span: IMPACT_LIMB_ARC_SPAN,

      segments: 34,

      lineWidth: 1.12 + limbIntensity * 0.72,

      color: warmColor,

      peakAlpha: limbIntensity * IMPACT_LIMB_ALPHA,

      falloff: IMPACT_LIMB_FALLOFF,
    })

    /**
     * -----------------------------------------------------------
     * DIAMOND POINT
     * -----------------------------------------------------------
     *
     * Desaparece antes que el limbo y la corona.
     */
    if (beadIntensity > 0.002) {
      context.shadowColor = rgba(
        hotColor,

        beadIntensity * IMPACT_BEAD_ALPHA,
      )

      context.shadowBlur = 5 + beadIntensity * 7

      context.beginPath()

      context.arc(
        contactX,
        contactY,

        IMPACT_BEAD_RADIUS + beadIntensity * 0.4,

        0,
        Math.PI * 2,
      )

      context.fillStyle = rgba(
        hotColor,

        beadIntensity * IMPACT_BEAD_ALPHA,
      )

      context.fill()
    }

    /**
     * -----------------------------------------------------------
     * GLINT TANGENCIAL
     * -----------------------------------------------------------
     *
     * Es la primera parte del impacto que desaparece.
     */
    if (glintIntensity > 0.002) {
      const glintLength = IMPACT_GLINT_LENGTH * glintIntensity

      context.shadowBlur = 3

      context.beginPath()

      context.moveTo(
        contactX - (tangentX * glintLength) / 2,

        contactY - (tangentY * glintLength) / 2,
      )

      context.lineTo(
        contactX + (tangentX * glintLength) / 2,

        contactY + (tangentY * glintLength) / 2,
      )

      context.strokeStyle = rgba(
        hotColor,

        glintIntensity * IMPACT_BEAD_ALPHA * 0.5,
      )

      context.lineWidth = 0.7

      context.stroke()
    }

    /**
     * -----------------------------------------------------------
     * RESIDUO DEL LIMBO
     * -----------------------------------------------------------
     *
     * Una segunda capa muy tenue se separa unos píxeles del borde
     * mientras desaparece.
     */
    drawTaperedArc({
      context,

      x: target.x,

      y: target.y,

      radius: targetRadius * (1.024 + smootherstep(progress) * 0.048),

      centerAngle: incomingAngle,

      span: IMPACT_LIMB_ARC_SPAN * 0.72,

      segments: 24,

      lineWidth: 0.68,

      color: warmColor,

      peakAlpha: limbIntensity * 0.105,

      falloff: IMPACT_LIMB_FALLOFF,
    })

    context.restore()
  }
}
