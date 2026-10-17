import type Konva from 'konva'
import { memo, type RefObject } from 'react'
import { Image, Rect, Shape } from 'react-konva'
import { CELL_SIZE, STATION_CELLS, STATIONS, stationSize, type Station } from '../../model/scene'
import { GATE_CELLS, type StationCorridor } from '../../lib/stations'
import { SceneElement } from './scene-element'
import { DroneGraphic } from './drone-station'

const noCorridors: readonly StationCorridor[] = []
const floorPatterns = new WeakMap<CanvasImageSource, CanvasPattern>()

/** Reuse one tile from the existing shared bitmap instead of allocating a huge raster for each large-floor variant. */
function floorPattern(context: Konva.Context, image: CanvasImageSource): CanvasPattern | null {
  const cached = floorPatterns.get(image)
  if (cached) return cached
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image instanceof HTMLCanvasElement ? image.width : 0
  if (!sourceWidth) return null
  const ratio = sourceWidth / (STATION_CELLS * CELL_SIZE + 8),
    tile = document.createElement('canvas')
  tile.width = tile.height = Math.round(CELL_SIZE * ratio)
  // An interior cell excludes corner rivets and walls; its phase matches every floor tile.
  tile
    .getContext('2d')
    ?.drawImage(image, (4 + CELL_SIZE) * ratio, (4 + CELL_SIZE) * ratio, tile.width, tile.height, 0, 0, tile.width, tile.height)
  const pattern = context.createPattern(tile, 'repeat')
  if (pattern) {
    pattern.setTransform(new DOMMatrix().scale(1 / ratio))
    floorPatterns.set(image, pattern)
  }
  return pattern
}

/** Large frames share the exact tile, wall profiles and gate clearance of station.svg, with no nodes per floor cell. */
function drawLargeStation(context: Konva.Context, shape: Konva.Shape) {
  const image: CanvasImageSource | null = shape.getAttr('artwork'),
    cells: number = shape.getAttr('cells'),
    size = cells * CELL_SIZE
  context.setAttr('fillStyle', image ? (floorPattern(context, image) ?? '#17191a') : '#17191a')
  context.fillRect(0, 0, size, size)
  const gates: readonly number[] = shape.getAttr('gates')
  context.beginPath()
  for (const edge of [-2.5, size + 2.5]) {
    let from = 0.5
    for (const gate of [...gates, cells]) {
      const to = gate === cells ? size - 0.5 : gate * CELL_SIZE - 2.5
      context.moveTo(from, edge)
      context.lineTo(to, edge)
      context.moveTo(edge, from)
      context.lineTo(edge, to)
      from = (gate + GATE_CELLS) * CELL_SIZE + 2.5
    }
  }
  context.moveTo(0.5, -2.5)
  context.quadraticCurveTo(-2.5, -2.5, -2.5, 0.5)
  context.moveTo(size - 0.5, -2.5)
  context.quadraticCurveTo(size + 2.5, -2.5, size + 2.5, 0.5)
  context.moveTo(size + 2.5, size - 0.5)
  context.quadraticCurveTo(size + 2.5, size + 2.5, size - 0.5, size + 2.5)
  context.moveTo(0.5, size + 2.5)
  context.quadraticCurveTo(-2.5, size + 2.5, -2.5, size - 0.5)
  context.setAttr('strokeStyle', '#798792')
  context.setAttr('lineWidth', 3)
  context.setAttr('lineJoin', 'round')
  context.stroke()
  context.beginPath()
  for (const edge of [-2.5, size + 2.5])
    for (const gate of gates) {
      context.moveTo(gate * CELL_SIZE, edge)
      context.lineTo((gate + GATE_CELLS) * CELL_SIZE, edge)
      context.moveTo(edge, gate * CELL_SIZE)
      context.lineTo(edge, (gate + GATE_CELLS) * CELL_SIZE)
    }
  context.setAttr('strokeStyle', 'rgba(129,151,162,0.7)')
  context.setAttr('lineWidth', 1.5)
  context.stroke()
  for (const x of [3, size - 3])
    for (const y of [3, size - 3]) {
      context.beginPath()
      context.arc(x, y, 2, 0, Math.PI * 2)
      context.setAttr('fillStyle', '#9da9af')
      context.fill()
      context.setAttr('strokeStyle', '#303a40')
      context.setAttr('lineWidth', 1)
      context.stroke()
    }
}

/** Paint one shared corridor bitmap per join, rotating it for vertical travel; outlines never enlarge floor support. */
function drawCorridors(context: Konva.Context, shape: Konva.Shape) {
  const corridors: readonly StationCorridor[] = shape.getAttr('corridors')
  const image: HTMLImageElement | null = shape.getAttr('artwork')
  for (const corridor of corridors) {
    const x = corridor.x * CELL_SIZE,
      y = corridor.y * CELL_SIZE
    context.setAttr('fillStyle', '#17191a')
    context.fillRect(x, y, corridor.width * CELL_SIZE, corridor.height * CELL_SIZE)
    if (image) {
      context.save()
      context.translate(x, y)
      if (corridor.width > corridor.height) {
        context.translate(corridor.width * CELL_SIZE, 0)
        context.rotate(Math.PI / 2)
      }
      if (Math.min(corridor.width, corridor.height) === 1) {
        // Keep full-sized tiles/walls in the shorter drone join; scaling the two-cell SVG would squeeze its tiles.
        context.drawImage(image, 0, 0, 14, 128, -4, -4, 14, 128)
        context.drawImage(image, 34, 0, 14, 128, 10, -4, 14, 128)
      } else context.drawImage(image, -4, -4)
      context.restore()
    }
    if (corridor.stationIds.includes(shape.getAttr('previewStationId'))) {
      context.setAttr('strokeStyle', shape.getAttr('previewColor') ?? '#f4b055')
      context.setAttr('lineWidth', 1 / (shape.getStage()?.scaleX() ?? 1))
      context.strokeRect(x, y, corridor.width * CELL_SIZE, corridor.height * CELL_SIZE)
    }
  }
}

/** Confirmed and provisional joins share corridor.svg in one native shape, without pointer listeners. */
export function CorridorGraphic({
  image,
  corridors = noCorridors,
  shapeRef,
}: {
  image: HTMLImageElement | null
  corridors?: readonly StationCorridor[]
  shapeRef?: RefObject<Konva.Shape | null>
}) {
  return <Shape ref={shapeRef} name="station-corridors" corridors={corridors} artwork={image} listening={false} sceneFunc={drawCorridors} />
}

/** The decorative frame never enlarges the logical floor or its hit footprint. */
export function StationGraphic({
  image,
  droneImage = null,
  station,
  connected,
  onOpenCargo,
  outlineColor = 'transparent',
}: {
  image: CanvasImageSource | null
  droneImage?: CanvasImageSource | null
  station?: Station
  connected?: ReadonlySet<string>
  onOpenCargo?: (slot: 0 | 1) => void
  outlineColor?: string
}) {
  const cells = stationSize(station ?? {}),
    size = cells * CELL_SIZE
  if (station?.type === 'drone')
    return <DroneGraphic station={station} image={droneImage} connected={connected} onOpenCargo={onOpenCargo} outlineColor={outlineColor} />
  return (
    <>
      <Rect width={size} height={size} fill="#17191a" />
      {cells !== STATION_CELLS ? (
        <Shape
          artwork={image}
          cells={cells}
          gates={STATIONS[station?.type ?? 'station'].gates}
          sceneFunc={drawLargeStation}
          listening={false}
        />
      ) : image ? (
        <Image image={image} x={-4} y={-4} width={size + 8} height={size + 8} listening={false} />
      ) : null}
      <Rect name="outline" width={size} height={size} stroke={outlineColor} strokeWidth={2} strokeScaleEnabled={false} listening={false} />
    </>
  )
}

/** Floor graphics remain independent of explicit-content transformations owned by the canvas. */
export const StationShape = memo(function StationShape({
  station,
  image,
  droneImage,
  connected,
  onOpenCargo,
  selected,
  interactive,
}: {
  station: Station
  image: CanvasImageSource | null
  droneImage: CanvasImageSource | null
  connected: ReadonlySet<string>
  onOpenCargo: (stationId: string, slot: 0 | 1) => void
  selected: boolean
  interactive: boolean
}) {
  return (
    <SceneElement element={station} span={stationSize(station)} kind="station">
      <StationGraphic
        image={image}
        droneImage={droneImage}
        station={station}
        connected={connected}
        onOpenCargo={interactive ? (slot) => onOpenCargo(station.id, slot) : undefined}
        outlineColor={selected ? '#f4b055' : 'transparent'}
      />
    </SceneElement>
  )
})
