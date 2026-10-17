import { useMemo } from 'react'
import { Group, Rect } from 'react-konva'
import { CELL_SIZE, type Scene } from '../../model/scene'
import { groupBounds } from '../../lib/scene-geometry'
import { beltNetwork } from '../../lib/belt-network'
import { stationCorridors } from '../../lib/stations'
import { BeltStaticGraphic } from '../elements/belt'
import { BuildingGraphic } from '../elements/building'
import { SplitterGraphic, TunnelGraphic } from '../elements/logistics'
import { CorridorGraphic, StationGraphic } from '../elements/station'

/** Complete snapshot artwork shares the canvas contours; moving its parent never recompiles its network or starts an animation. */
export function GroupPreview({
  scene,
  image,
  corridorImage,
  droneImage,
}: {
  scene: Scene
  image: CanvasImageSource | null
  corridorImage: HTMLImageElement | null
  droneImage: CanvasImageSource | null
}) {
  const network = useMemo(() => {
    // A pieces-only snapshot has no floors. Its already-confirmed routes provide a finite expansion bound.
    const limit = scene.belts.reduce(
      (maximum, belt) =>
        Math.max(
          maximum,
          1 +
            belt.points
              .slice(1)
              .reduce((length, point, i) => length + Math.abs(point.x - belt.points[i].x) + Math.abs(point.y - belt.points[i].y), 0),
        ),
      0,
    )
    return beltNetwork(scene, limit)
  }, [scene])
  const bounds = groupBounds(scene)
  if (!bounds) return null
  return (
    <>
      {scene.stations
        .filter((station) => station.type !== 'drone')
        .map((station) => (
          <Group key={station.id} x={station.x * CELL_SIZE} y={station.y * CELL_SIZE}>
            <StationGraphic station={station} image={image} />
          </Group>
        ))}
      <CorridorGraphic image={corridorImage} corridors={stationCorridors(scene.stations)} />
      <BeltStaticGraphic scene={scene} network={network} />
      {scene.stations
        .filter((station) => station.type === 'drone')
        .map((station) => (
          <Group key={station.id} x={station.x * CELL_SIZE} y={station.y * CELL_SIZE}>
            <StationGraphic station={station} image={image} droneImage={droneImage} connected={network.connectedPorts} />
          </Group>
        ))}
      {(scene.splitters ?? []).map((splitter) => (
        <Group key={splitter.id} x={splitter.x * CELL_SIZE} y={splitter.y * CELL_SIZE}>
          <SplitterGraphic splitter={splitter} connected={network.connectedPorts} />
        </Group>
      ))}
      {scene.buildings.map((building) => (
        <Group key={building.id} x={building.x * CELL_SIZE} y={building.y * CELL_SIZE}>
          <BuildingGraphic building={building} roles={network.portRoles.get(building.id)} />
        </Group>
      ))}
      {(scene.tunnels ?? []).map((tunnel) => (
        <TunnelGraphic key={tunnel.id} tunnel={tunnel} showGuide connected={network.connectedPorts} />
      ))}
      <Rect
        name="outline group-outline"
        x={bounds.x * CELL_SIZE}
        y={bounds.y * CELL_SIZE}
        width={bounds.width * CELL_SIZE}
        height={bounds.height * CELL_SIZE}
        strokeWidth={1}
        strokeScaleEnabled={false}
        listening={false}
      />
    </>
  )
}
