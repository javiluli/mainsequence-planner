import Konva from 'konva'
import { memo, useEffect, useMemo, useRef, type RefObject } from 'react'
import { Circle, Group, Layer, Rect, Shape, Text } from 'react-konva'
import { CELL_SIZE, type Belt, type Point, type Scene, type Selection } from '../../model/scene'
import { BELTS } from '../../model/logistics'
import type { BeltNetwork } from '../../lib/belt-network'
import type { WorldBounds } from '../canvas/viewport'
import { beltLevelPosition, beltRenderGeometry, traceBeltSection, type BeltSection } from './belt-geometry'
import { BuildingPortShape } from './building-port'
import { highlightedTrack } from './highlight'
import { prepareBeltConnections, prepareBeltTracks, preparePortBridges, routeBounds } from './belt-drawing'

/** Junction and port decorations stay inside one world cell, including their stroke. */
const cellBounds = (cell: Point): WorldBounds => ({ x: cell.x * CELL_SIZE, y: cell.y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE })

/** Native track/hit contour: terminal bridges and corners are already part of the same complete path. */
function drawTrack(context: Konva.Context, shape: Konva.Shape) {
  const paths: readonly (readonly BeltSection[])[] = shape.getAttr('geometry')
  context.beginPath()
  for (const sections of paths) {
    if (!sections.length) continue
    context.moveTo(sections[0].from.x, sections[0].from.y)
    for (const section of sections) traceBeltSection(context, section)
  }
  context.strokeShape(shape)
}

/** Each bend uses the same fraction of the cell clock; native dash painting avoids one node or object allocation per moving item. */
function drawSlats(context: Konva.Context, shape: Konva.Shape) {
  const paths: readonly (readonly BeltSection[])[] = shape.getAttr('geometry'),
    clock: RefObject<number> | undefined = shape.getAttr('clock'),
    preview: boolean = shape.getAttr('preview'),
    time = clock?.current ?? 0
  context.setAttr('lineWidth', 4)
  for (const sections of paths)
    for (const section of sections) {
      if (!section.active && !preview) continue
      context.setAttr('strokeStyle', section.active ? '#d2b77e' : '#acbcc5')
      context.setLineDash([CELL_SIZE * 0.6 * section.scale, CELL_SIZE * 0.4 * section.scale])
      context.setAttr('lineDashOffset', (section.offset - (section.active ? time : 0)) * section.scale)
      context.beginPath()
      context.moveTo(section.from.x, section.from.y)
      traceBeltSection(context, section)
      context.stroke()
    }
}

/** One animation node per route, regardless of its cells or activity changes. */
function BeltSlats({
  geometry,
  clock,
  preview = false,
}: {
  geometry: readonly (readonly BeltSection[])[]
  clock?: RefObject<number>
  preview?: boolean
}) {
  const moving = geometry.some((sections) => sections.some((section) => section.active))
  if (!moving && !preview) return null
  return (
    <Shape
      name={`route-line ${moving ? 'moving-items' : 'items'}`}
      geometry={geometry}
      clock={clock}
      preview={preview}
      sceneFunc={drawSlats}
      listening={false}
    />
  )
}

/** Preview artwork uses the same track and slats as the confirmed layer, without inferred connections. */
export function BeltGraphic({
  points,
  heading,
  type,
  startNormal,
  showLevel = false,
}: {
  points: readonly Point[]
  heading?: Point
  type?: Belt['type']
  startNormal?: Point
  showLevel?: boolean
}) {
  const geometry = beltRenderGeometry(points, heading)
  const bounds = points.length ? routeBounds(points) : null
  return (
    <>
      {/* Custom canvas paths need an explicit native extent for thumbnail cropping; this paints no backdrop. */}
      {bounds && <Rect {...bounds} fill="rgba(0,0,0,0)" listening={false} />}
      <Shape name="outline route-line" geometry={geometry} sceneFunc={drawTrack} stroke="#84949e" strokeWidth={14} lineJoin="round" />
      <Shape
        name="route-line track-highlight"
        geometry={geometry}
        sceneFunc={drawTrack}
        stroke="#293e49"
        strokeWidth={10}
        lineJoin="round"
        listening={false}
      />
      <BeltSlats geometry={geometry} preview />
      {showLevel && <BeltLevel points={points} type={type} normal={startNormal ?? heading} />}
    </>
  )
}

/** Tier is contextual text only; neither rail appearance nor the shared item clock changes. */
function BeltLevel({
  points,
  type,
  normal,
  owner,
  viewport = false,
}: {
  points: readonly Point[]
  type?: Belt['type']
  normal?: Point
  owner?: Selection
  viewport?: boolean
}) {
  const { x, y } = beltLevelPosition(points, normal)
  return (
    <Text
      name={viewport ? 'belt-level viewport-element' : 'belt-level'}
      selection={owner}
      x={x}
      y={y}
      width={32}
      height={8}
      worldBounds={{ x, y, width: 32, height: 8 }}
      text={BELTS[type ?? 'conveyor'].marking}
      fontSize={6}
      fontFamily="Geist, sans-serif"
      fill="#f4b055"
      align="center"
      listening={false}
    />
  )
}

/** Keep the existing invalidation boundaries shared by confirmed layers and static group previews. */
function useBeltGeometry(scene: Scene, network: BeltNetwork) {
  const connections = useMemo(
    () => prepareBeltConnections({ belts: scene.belts, splitters: scene.splitters, tunnels: scene.tunnels }, network),
    [scene.belts, scene.splitters, scene.tunnels, network],
  )
  const tracks = useMemo(() => prepareBeltTracks(scene.belts, network, connections), [scene.belts, network, connections])
  const { attachments } = connections
  const bridges = useMemo(() => preparePortBridges(network.portBridges), [network.portBridges])
  return { tracks, attachments, bridges }
}

type BeltDrawing = ReturnType<typeof useBeltGeometry>
const unselected: ReadonlySet<string> = new Set()

/** Static tracks and non-interactive items draw independently; one native clock honors live reduced motion. */
export const BeltLayer = memo(function BeltLayer({
  scene,
  network,
  selectedIds,
  draftingBeltId,
}: {
  scene: Scene
  network: BeltNetwork
  selectedIds: ReadonlySet<string>
  draftingBeltId?: string
}) {
  const ref = useRef<Konva.Layer | null>(null)
  const clock = useRef(0)
  const drawing = useBeltGeometry(scene, network)
  useEffect(() => {
    const layer = ref.current,
      slats = layer?.find<Konva.Shape>('.moving-items')
    if (!layer || !slats?.length) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    // Sample once per actual draw, including camera redraws: newly visible paths cannot display an old frozen phase.
    layer.on('beforeDraw.belt-flow', () => {
      clock.current = motion.matches ? 0 : (performance.now() * 0.05) % CELL_SIZE
    })
    const animation = new Konva.Animation(() => slats.some((shape) => shape.isVisible()), layer)
    const sync = () => {
      if (motion.matches) {
        animation.stop()
        layer.batchDraw()
      } else {
        animation.start()
      }
    }
    sync()
    motion.addEventListener('change', sync)
    return () => {
      animation.stop()
      motion.removeEventListener('change', sync)
      layer.off('.belt-flow')
    }
  }, [network])
  return (
    <>
      <Layer>
        <BeltTracks drawing={drawing} network={network} selectedIds={selectedIds} draftingBeltId={draftingBeltId} />
      </Layer>
      <Layer ref={ref} listening={false}>
        <BeltItems drawing={drawing} clock={clock} />
      </Layer>
    </>
  )
})

/** Clipboard ghosts use exactly the confirmed contours, without Layers, hit painting or an animation clock. */
export function BeltStaticGraphic({ scene, network }: { scene: Scene; network: BeltNetwork }) {
  const drawing = useBeltGeometry(scene, network)
  return (
    <Group listening={false}>
      <BeltTracks drawing={drawing} network={network} selectedIds={unselected} viewport={false} showLevels />
      <BeltItems drawing={drawing} viewport={false} />
    </Group>
  )
}

/** Borders precede surfaces across all complete routes and socket bridges. */
function BeltTracks({
  drawing: { tracks, attachments, bridges },
  network,
  selectedIds,
  viewport = true,
  showLevels = false,
  draftingBeltId,
}: {
  drawing: BeltDrawing
  network: BeltNetwork
  selectedIds: ReadonlySet<string>
  viewport?: boolean
  showLevels?: boolean
  draftingBeltId?: string
}) {
  const colorFor = (ids: readonly string[], width: number) => {
    const color = ids.some((id) => selectedIds.has(id)) ? '#f4b055' : undefined
    return width === 10 ? (color ? highlightedTrack(color) : '#293e49') : (color ?? '#84949e')
  }
  return (
    <Group>
      {/* All borders precede all surfaces, so a shared cell has one open junction instead of overpainted seams. */}
      {[14, 10].map((width) => (
        <Group key={width} listening={width === 14}>
          {tracks.map(({ belt, geometry, bounds }) => (
            <Shape
              key={belt.id}
              name={`${viewport ? 'viewport-element' : ''} ${width === 10 ? 'track-highlight' : 'outline'}`}
              selection={{ kind: 'belt', id: belt.id }}
              worldBounds={bounds}
              geometry={geometry}
              sceneFunc={drawTrack}
              stroke={colorFor([belt.id], width)}
              strokeWidth={width}
              lineJoin="round"
              hitStrokeWidth={CELL_SIZE}
            />
          ))}
          {network.junctions.map(({ cell, beltIds }) => (
            <Circle
              key={`${cell.x},${cell.y}`}
              name={`${viewport ? 'viewport-element' : ''} ${width === 10 ? 'track-fill-highlight' : 'rail-fill-highlight'}`}
              dragOwners={beltIds}
              worldBounds={cellBounds(cell)}
              x={(cell.x + 0.5) * CELL_SIZE}
              y={(cell.y + 0.5) * CELL_SIZE}
              radius={width / 2}
              fill={colorFor(beltIds, width)}
              listening={false}
            />
          ))}
          {bridges.map((bridge, i) => {
            const stroke = colorFor([bridge.owner.id], width)
            return (
              <Group
                key={`bridge-${i}`}
                name={viewport ? 'viewport-element' : ''}
                selection={bridge.owner}
                worldBounds={cellBounds(bridge.cell)}
                listening={false}
              >
                <Shape
                  name={width === 10 ? 'track-highlight' : 'outline'}
                  geometry={bridge.geometry}
                  sceneFunc={drawTrack}
                  stroke={stroke}
                  strokeWidth={width}
                />
              </Group>
            )
          })}
          {attachments.map((path, i) => (
            <Shape
              key={`attachment-${i}`}
              name={`${viewport ? 'viewport-element' : ''} ${width === 10 ? 'track-highlight' : 'outline'}`}
              dragOwners={path.beltId ? [path.owner.id, path.beltId] : [path.owner.id]}
              worldBounds={path.bounds}
              geometry={path.geometry}
              sceneFunc={drawTrack}
              strokeWidth={width}
              lineJoin="round"
              listening={false}
              stroke={colorFor([path.owner.id, ...(path.beltId ? [path.beltId] : [])], width)}
            />
          ))}
        </Group>
      ))}
      {tracks.flatMap(({ belt, caps }) =>
        caps
          .filter((cap) => cap.index !== 1 || belt.id !== draftingBeltId)
          .map((port) => (
            <Group
              key={`${belt.id}:${port.key}`}
              name={viewport ? 'viewport-element belt-end' : 'belt-end'}
              selection={{ kind: 'belt', id: belt.id }}
              worldBounds={cellBounds(port.cell)}
            >
              <BuildingPortShape port={port} origin={{ x: 0, y: 0 }} connected={false} />
            </Group>
          )),
      )}
      {tracks
        .filter(({ belt }) => showLevels || selectedIds.has(belt.id))
        .map(({ belt, normal }) => (
          <BeltLevel
            key={belt.id}
            points={belt.points}
            type={belt.type}
            normal={normal}
            owner={{ kind: 'belt', id: belt.id }}
            viewport={viewport}
          />
        ))}
    </Group>
  )
}

/** No hit canvas or static geometry is repainted by the item clock. Native batchDraw coalesces camera and animation. */
function BeltItems({
  drawing: { tracks, attachments, bridges },
  clock,
  viewport = true,
}: {
  drawing: BeltDrawing
  clock?: RefObject<number>
  viewport?: boolean
}) {
  return (
    <Group listening={false}>
      {tracks.map(({ belt, bounds, geometry }) => (
        <Group
          key={belt.id}
          name={viewport ? 'viewport-element' : ''}
          selection={{ kind: 'belt', id: belt.id }}
          worldBounds={bounds}
          listening={false}
        >
          <BeltSlats geometry={geometry} clock={clock} />
        </Group>
      ))}
      {attachments.map((path, i) => (
        <Group
          key={`slats-${i}`}
          name={viewport ? 'viewport-element' : ''}
          dragOwners={path.beltId ? [path.owner.id, path.beltId] : [path.owner.id]}
          worldBounds={routeBounds(path.points)}
          listening={false}
        >
          <BeltSlats geometry={path.geometry} clock={clock} />
        </Group>
      ))}
      {bridges.map((bridge, i) => (
        <Group
          key={`port-slats-${i}`}
          name={viewport ? 'viewport-element' : ''}
          selection={bridge.owner}
          worldBounds={cellBounds(bridge.cell)}
          listening={false}
        >
          <BeltSlats geometry={bridge.geometry} clock={clock} />
        </Group>
      ))}
    </Group>
  )
}
