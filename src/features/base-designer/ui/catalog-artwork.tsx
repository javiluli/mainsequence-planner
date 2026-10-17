import type Konva from 'konva'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Group, Image, Layer, Rect, Stage } from 'react-konva'
import { BUILDINGS, type BuildingType } from '../model/buildings'
import { BELTS, SPLITTERS, TUNNELS } from '../model/logistics'
import { CELL_SIZE } from '../model/scene'
import { BeltGraphic } from './elements/belt'
import { buildingSurface, BUILDING_RADIUS, categoryColors } from './elements/building-surface'
import { SplitterGraphic, TunnelGraphic } from './elements/logistics'
import { StationGraphic } from './elements/station'
import stationUrl from './elements/station.svg'
import droneUrl from './elements/drone-station.svg'

type ArtworkImages = { station: HTMLImageElement | null; drone: HTMLImageElement | null }
let thumbnails: Readonly<Record<string, string>> | null = null

/** One temporary Stage snapshots the editor's own figures, then unmounts. Cards keep only small static images. */
export function CatalogArtwork({ onReady }: { onReady: (images: Readonly<Record<string, string>>) => void }) {
  const layer = useRef<Konva.Layer>(null)
  const [images, setImages] = useState<ArtworkImages | null>(null)
  useEffect(() => {
    if (thumbnails) {
      onReady(thumbnails)
      return
    }
    let canceled = false
    const load = (url: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const image = new window.Image()
        image.onload = () => resolve(image)
        image.onerror = () => resolve(null)
        image.src = url
      })
    void Promise.all([load(stationUrl), load(droneUrl), document.fonts.ready]).then(([station, drone]) => {
      if (!canceled) setImages({ station, drone })
    })
    return () => {
      canceled = true
    }
  }, [onReady])
  useLayoutEffect(() => {
    if (!images || !layer.current) return
    const result: Record<string, string> = {}
    for (const group of layer.current.getChildren()) {
      // Fixed miniature bounds center single-face machines too; custom belt paths must not include their invisible origin.
      const bounds = Object.hasOwn(BUILDINGS, group.id())
        ? { x: 0, y: 0, width: 64, height: 64 }
        : Object.hasOwn(BELTS, group.id())
          ? { x: 0, y: CELL_SIZE, width: CELL_SIZE * 3, height: CELL_SIZE }
          : group.getClientRect()
      result[group.id()] = group.toDataURL({
        x: bounds.x - 4,
        y: bounds.y - 4,
        width: bounds.width + 8,
        height: bounds.height + 8,
        pixelRatio: Math.min(128 / (bounds.width + 8), 80 / (bounds.height + 8)) * 2,
      })
    }
    thumbnails = result
    onReady(result)
  }, [images, onReady])
  if (!images) return null
  return (
    <div aria-hidden className="pointer-events-none fixed -left-[9999px] top-0">
      <Stage width={1} height={1}>
        <Layer ref={layer} listening={false}>
          <Group id="station">
            <CatalogStationGraphic image={images.station} divisions={2} />
          </Group>
          <Group id="station_2x2_a">
            <CatalogStationGraphic image={images.station} divisions={4} />
          </Group>
          <Group id="drone">
            <StationGraphic
              image={null}
              droneImage={images.drone}
              station={{ id: 'catalog-drone', type: 'drone', x: 0, y: 0, rotation: 0, cargo: [null, null] }}
            />
          </Group>
          {Object.keys(BUILDINGS).map((key) => (
            <Group key={key} id={key}>
              <CatalogBuildingGraphic type={key as BuildingType} />
            </Group>
          ))}
          {(Object.keys(BELTS) as (keyof typeof BELTS)[]).map((key) => (
            <Group key={key} id={key}>
              <BeltGraphic
                type={key}
                points={[
                  { x: 0, y: 1 },
                  { x: 2, y: 1 },
                ]}
              />
            </Group>
          ))}
          {Object.keys(SPLITTERS).map((key) => (
            <Group key={key} id={key}>
              <SplitterGraphic splitter={{ type: key as keyof typeof SPLITTERS, x: 0, y: 0, rotation: 0 }} />
            </Group>
          ))}
          {Object.keys(TUNNELS).map((key) => (
            <Group key={key} id={key}>
              <TunnelGraphic tunnel={{ type: key as keyof typeof TUNNELS, entry: { x: 0, y: 0 }, exit: { x: 3, y: 0 } }} showGuide />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  )
}

/** A 64px catalog symbol preserves each building's port counts/faces with clear, evenly spaced sockets; it never defines placement geometry. */
function CatalogBuildingGraphic({ type }: { type: BuildingType }) {
  const { category, offsets, singleFace } = BUILDINGS[type],
    image = buildingSurface(64)
  return (
    <>
      {image ? (
        <Image image={image} width={64} height={64} />
      ) : (
        <Rect width={64} height={64} cornerRadius={BUILDING_RADIUS} fill="#7c8f9a" stroke="#485f6b" />
      )}
      <Rect x={4} y={25} width={56} height={14} fill={categoryColors[category]} listening={false} />
      {[0, 1, 2, 3].flatMap((face) =>
        singleFace && face !== 2
          ? []
          : offsets.map((_, index) => {
              const along = ((index + 1) * 64) / (offsets.length + 1),
                horizontal = face === 0 || face === 2,
                x = horizontal ? along : face === 1 ? 64 : 0,
                y = horizontal ? (face === 0 ? 0 : 64) : along
              return (
                <Rect
                  key={face + ':' + index}
                  name="catalog-port"
                  x={x - (horizontal ? 6 : 2)}
                  y={y - (horizontal ? 2 : 6)}
                  width={horizontal ? 12 : 4}
                  height={horizontal ? 4 : 12}
                  cornerRadius={1.2}
                  fill="#bac6ce"
                  stroke="#485f6b"
                  strokeWidth={1}
                  listening={false}
                />
              )
            }),
      )}
    </>
  )
}

/** Miniature floor reuses the actual SVG tile, with 2×2/4×4 cells and the catalog's gray frame. */
function CatalogStationGraphic({ image, divisions }: { image: HTMLImageElement | null; divisions: 2 | 4 }) {
  const tile = 62 / divisions
  return (
    <>
      <Rect width={64} height={64} fill="#17191a" cornerRadius={2} />
      {image &&
        Array.from({ length: divisions ** 2 }, (_, index) => (
          <Image
            key={index}
            image={image}
            // Interior cells exclude the frame and corner rivets, just like the large canvas floor.
            crop={{ x: 4 + CELL_SIZE, y: 4 + CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }}
            x={1 + (index % divisions) * tile}
            y={1 + Math.floor(index / divisions) * tile}
            width={tile}
            height={tile}
            listening={false}
          />
        ))}
      <Rect width={64} height={64} stroke="#798792" strokeWidth={1.5} cornerRadius={2} />
    </>
  )
}
