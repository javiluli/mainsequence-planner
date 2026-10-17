import { memo } from 'react'
import { Circle, Group, Image, Rect, Text } from 'react-konva'
import { BUILDINGS, buildingPorts, type Building } from '../../model/buildings'
import { CELL_SIZE } from '../../model/scene'
import { SceneElement } from './scene-element'
import { BuildingPortShape } from './building-port'
import { portBodyClip } from './port-geometry'
import { recipeForBuilding } from '../../lib/building-recipes'
import { ItemIcon } from './item-icon'
import { buildingSurface, BUILDING_RADIUS, categoryColors } from './building-surface'
import { highlightFill } from './highlight'
import type { MachineAnalysis } from '../../lib/production-analysis'
import { machineStatus } from '../machine-status'

/** Shared housing and category nameplate retain every measured physical port. */
export function BuildingGraphic({
  building,
  selected = false,
  roles = {},
  analysis,
}: {
  building: Omit<Building, 'id'>
  selected?: boolean
  roles?: Readonly<Record<string, 'input' | 'output'>>
  analysis?: MachineAnalysis
}) {
  const { size, marking, category } = BUILDINGS[building.type],
    pixels = size * CELL_SIZE,
    ports = buildingPorts(building),
    recipe = recipeForBuilding(building.type, building.recipeId)
  return (
    <>
      <Group
        clipFunc={portBodyClip(
          { x: -5, y: -5, width: pixels + 10, height: pixels + 10 },
          ports.filter((port) => !!roles[port.key]),
          building,
        )}
      >
        <BuildingArtwork
          size={size}
          label={marking}
          category={category}
          rotation={building.rotation}
          highlightColor={selected ? '#f4b055' : undefined}
          bodyColor={analysis?.state === 'shortfall' ? '#ef4444' : undefined}
        />
        {recipe && <ItemIcon id={recipe.output.id} size={16} x={pixels - 14} y={pixels - 14} />}
        {analysis && (
          <Circle
            name="machine-led"
            status={analysis.state}
            x={pixels - 7}
            y={pixels - 7}
            radius={2.3}
            fill={machineStatus[analysis.state].color}
            stroke="#23333b"
            strokeWidth={0.7}
            listening={false}
          />
        )}
      </Group>
      {ports.map((port) => (
        <BuildingPortShape key={port.key} port={port} origin={building} role={roles[port.key]} />
      ))}
    </>
  )
}

/** Shared shell for canvas machines and catalog miniatures; artwork does not define physical ports. */
export function BuildingArtwork({
  size,
  label,
  rotation = 0,
  category,
  highlightColor,
  bodyColor,
}: {
  size: number
  label: string
  rotation?: number
  category: keyof typeof categoryColors
  highlightColor?: string
  bodyColor?: string
}) {
  const pixels = size * CELL_SIZE,
    image = buildingSurface(pixels),
    bodyHighlight = bodyColor ?? highlightColor
  return (
    <>
      {/* Keep the logical hit footprint while letting the housing's rounded corners stay transparent. */}
      <Rect width={pixels} height={pixels} fill="rgba(0,0,0,0)" />
      <Group x={pixels / 2} y={pixels / 2} listening={false}>
        <Group rotation={rotation}>
          {image ? (
            <Image image={image} x={-pixels / 2} y={-pixels / 2} width={pixels} height={pixels} />
          ) : (
            <Rect
              x={-pixels / 2}
              y={-pixels / 2}
              width={pixels}
              height={pixels}
              cornerRadius={BUILDING_RADIUS}
              fill="#7c8f9a"
              stroke="#485f6b"
            />
          )}
        </Group>
        <Rect
          name="outline body-highlight"
          x={-pixels / 2}
          y={-pixels / 2}
          width={pixels}
          height={pixels}
          cornerRadius={BUILDING_RADIUS}
          fill={bodyHighlight ? highlightFill(bodyHighlight) : 'transparent'}
          stroke={highlightColor ?? 'transparent'}
          strokeWidth={1}
        />
        <Rect x={-pixels / 2 + 4} y={-7} width={pixels - 8} height={14} fill={categoryColors[category]} />
        <Text
          x={-pixels / 2 + 4}
          y={-4}
          width={pixels - 8}
          text={label.toUpperCase()}
          align="center"
          fontFamily="Geist, sans-serif"
          fontSize={size <= 3 ? 7 : 9}
          fill="#30291e"
          fontStyle="bold"
        />
      </Group>
    </>
  )
}

/** Confirmed artwork shows nominal input status without changing ports, items or selection identity. */
export const BuildingShape = memo(function BuildingShape({
  building,
  selected,
  roles,
  analysis,
}: {
  building: Building
  selected: boolean
  roles: Readonly<Record<string, 'input' | 'output'>>
  analysis: MachineAnalysis | undefined
}) {
  return (
    <SceneElement element={building} span={BUILDINGS[building.type].size} kind="building">
      <BuildingGraphic building={building} selected={selected} roles={roles} analysis={analysis} />
    </SceneElement>
  )
})
