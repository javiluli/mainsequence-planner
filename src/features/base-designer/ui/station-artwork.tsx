import { Button, cn } from '@heroui/react'
import { Plus } from 'lucide-react'
import { memo } from 'react'
import { itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import type { BaseStation } from '../lib/placement'
import { droneOutputPorts, droneRotation, stationOpenFaces, type StationCorridor } from '../lib/stations'
import { faceSteps } from '../lib/station-spatial'
import { CELL_SIZE, DRONE_CORRIDOR_CELLS, STATION_GATE_CELLS, STATION_TYPES, type Direction } from '../model/catalog'
import type { RouteAnchor } from '../lib/route'
import { PortMarker } from './port-marker'

const frameClearance = 4
const droneDeckLeft = STATION_TYPES.drone_station.gateStarts[0] * CELL_SIZE
const droneDeckRight = droneDeckLeft + STATION_GATE_CELLS * CELL_SIZE
const droneBayPositions = [36, 197] as const
// Enlarge the body and its cargo controls together, never the deck, ports or reserved footprint.
const droneBodyScale = 1.12
const noCorridors: readonly StationCorridor[] = []

/** Decorative glazing follows existing corridors; it never reserves or validates floor cells. */
function doorwayConnected(station: BaseStation, face: Direction, gate: number, corridors: readonly StationCorridor[]): boolean {
  const x = station.position.x / CELL_SIZE
  const y = station.position.y / CELL_SIZE
  const size = STATION_TYPES[station.type].footprintCells
  return corridors.some((corridor) => {
    if (corridor.ownerId !== station.id && corridor.otherId !== station.id) return false
    switch (face) {
      case 'north':
        return corridor.x === x + gate && corridor.width === STATION_GATE_CELLS && corridor.y + corridor.height === y
      case 'south':
        return corridor.x === x + gate && corridor.width === STATION_GATE_CELLS && corridor.y === y + size
      case 'west':
        return corridor.y === y + gate && corridor.height === STATION_GATE_CELLS && corridor.x + corridor.width === x
      case 'east':
        return corridor.y === y + gate && corridor.height === STATION_GATE_CELLS && corridor.x === x + size
    }
  })
}

function framePath(station: BaseStation): string {
  const { footprintCells, gateStarts } = STATION_TYPES[station.type]
  const openFaces = stationOpenFaces(station)
  const size = footprintCells * CELL_SIZE + frameClearance * 2
  const coordinate = (cell: number) => (cell === 0 ? 4.5 : cell === footprintCells ? size - 4.5 : frameClearance + cell * CELL_SIZE)
  const corners = `M1.5 4.5 Q1.5 1.5 4.5 1.5 M${size - 4.5} 1.5 Q${size - 1.5} 1.5 ${size - 1.5} 4.5 M${size - 1.5} ${size - 4.5} Q${size - 1.5} ${size - 1.5} ${size - 4.5} ${size - 1.5} M4.5 ${size - 1.5} Q1.5 ${size - 1.5} 1.5 ${size - 4.5}`
  const rails = (['north', 'south', 'west', 'east'] as const)
    .flatMap((face) => {
      const rails: [number, number][] = []
      let start = 0
      if (openFaces.includes(face))
        for (const gate of gateStarts) {
          rails.push([start, gate])
          start = gate + STATION_GATE_CELLS
        }
      rails.push([start, footprintCells])
      return rails.map(([from, to]) =>
        face === 'north'
          ? `M${coordinate(from)} 1.5 H${coordinate(to)}`
          : face === 'south'
            ? `M${coordinate(from)} ${size - 1.5} H${coordinate(to)}`
            : face === 'west'
              ? `M1.5 ${coordinate(from)} V${coordinate(to)}`
              : `M${size - 1.5} ${coordinate(from)} V${coordinate(to)}`,
      )
    })
    .join(' ')
  return `${rails} ${corners}`
}

/** Shared by committed nodes and cursor previews, with no change to reserved cell footprints. */
export const StationFrame = memo(function StationFrame({
  station,
  corridors,
  interactive = false,
}: {
  station: BaseStation
  corridors: readonly StationCorridor[]
  interactive?: boolean
}) {
  if (station.type === 'drone_station') return null
  const size = STATION_TYPES[station.type].footprintCells * CELL_SIZE + frameClearance * 2
  const path = framePath(station)
  return (
    <svg
      className={cn('base-station-frame absolute', interactive && 'base-station-frame--interactive')}
      style={{ left: -frameClearance, top: -frameClearance }}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <path className="base-station-frame-hit" d={path} />
      <path className="base-station-wall" d={path} />
      {stationOpenFaces(station).flatMap((face) =>
        STATION_TYPES[station.type].gateStarts.flatMap((gate) => {
          if (doorwayConnected(station, face, gate, corridors)) return []
          const horizontal = face === 'north' || face === 'south'
          const start = frameClearance + gate * CELL_SIZE
          const edge = face === 'north' || face === 'west' ? 1.5 : size - 1.5
          const length = STATION_GATE_CELLS * CELL_SIZE
          return [
            <g key={`${face}-${gate}`} className="base-station-window" data-face={face}>
              <line
                x1={horizontal ? start : edge}
                y1={horizontal ? edge : start}
                x2={horizontal ? start + length : edge}
                y2={horizontal ? edge : start + length}
              />
            </g>,
          ]
        }),
      )}
      <circle cx="7" cy="7" r="2" />
      <circle cx={size - 7} cy="7" r="2" />
      <circle cx="7" cy={size - 7} r="2" />
      <circle cx={size - 7} cy={size - 7} r="2" />
    </svg>
  )
})

export function DroneStationArtwork({
  station,
  corridors = noCorridors,
  onAssign,
  hoveredPort,
}: {
  station: BaseStation
  corridors?: readonly StationCorridor[]
  onAssign?: (slot: 0 | 1) => void
  hoveredPort?: RouteAnchor | null
}) {
  const angle = droneRotation(station.direction)
  const connected = doorwayConnected(station, stationOpenFaces(station)[0], STATION_TYPES.drone_station.gateStarts[0], corridors)
  // Only the side rails bridge the passage: its buildable floor tiles must remain visible.
  const deckEnd = 280 + (connected ? DRONE_CORRIDOR_CELLS * CELL_SIZE - 2.5 : 0)
  return (
    <>
      <div className="absolute inset-0 z-[2]" style={{ transform: `rotate(${angle}deg)` }}>
        <svg
          className="base-drone-art pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 280 280"
          aria-hidden
        >
          <path d={`M${droneDeckLeft} 280V197q0-4 4-4h${droneDeckRight - droneDeckLeft - 8}q4 0 4 4v83z`} fill="#526672" />
          <path
            d={`M${droneDeckLeft} ${deckEnd}V197q0-4 4-4h${droneDeckRight - droneDeckLeft - 8}q4 0 4 4v${deckEnd - 197}`}
            fill="none"
            stroke="#8396a0"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d={`M${droneDeckLeft + 6} 200h${droneDeckRight - droneDeckLeft - 12}v80H${droneDeckLeft + 6}z`} fill="#71848e" />
          <path d="M120 207v56m40-56v56" fill="none" stroke="#4a5e68" strokeWidth="3" strokeLinecap="round" />
          <g transform={`translate(140 140) scale(${droneBodyScale}) translate(-140 -140)`}>
            <path
              className="base-drone-hull"
              d="M92 54h96q4 0 8 3l50 37q4 3 4 9v74q0 6-4 9l-50 37q-4 3-8 3H92q-4 0-8-3l-50-37q-4-3-4-9v-74q0-6 4-9l50-37q4-3 8-3z"
              fill="#aebbc4"
              stroke="#526672"
              strokeWidth="5"
            />
            <path
              d="M95 62h90q4 0 8 3l45 33q4 3 4 9v66q0 6-4 9l-45 33q-4 3-8 3H95q-4 0-8-3l-45-33q-4-3-4-9v-66q0-6 4-9l45-33q4-3 8-3z"
              fill="#d1d8dc"
              stroke="#eff2f1"
              strokeWidth="2"
            />
            <path d="M115 62h50l-8 24h-34zM95 200h90l-6 18h-78z" fill="#899aa5" />
            {droneBayPositions.map((x) => (
              <g key={x}>
                <rect x={x} y="119" width="47" height="46" rx="10" fill="#e7bd66" stroke="#956b35" strokeWidth="2" />
                <rect x={x + 5} y="124" width="37" height="36" rx="6" fill="#8797a1" stroke="#50626e" strokeWidth="1.5" />
              </g>
            ))}
            <path
              d="M125 98h30q2 0 3 3l15 35q1 2 0 4l-7 42q-.5 3-3 3h-46q-2.5 0-3-3l-7-42q-1-2 0-4l15-35q1-3 3-3z"
              fill="#8797a1"
              stroke="#526672"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M115 124h50q2 0 3 2l9 10q2 2 0 4l-9 10q-1 2-3 2h-50q-2 0-3-2l-9-10q-2-2 0-4l9-10q1-2 3-2z"
              fill="#e7ad45"
              stroke="#956b35"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <rect x="116" y="132" width="12" height="12" rx="2" fill="#526672" />
            <circle cx="151" cy="138" r="8" fill="#526672" stroke="#e6d6af" strokeWidth="3" />
            <text x="140" y="174" textAnchor="middle" fill="#18313b" fontSize="9" fontWeight="700" letterSpacing="0.5">
              Drone
            </text>
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0" style={{ transform: `scale(${droneBodyScale})` }}>
          {([0, 1] as const).map((slot) => {
            const itemId = station.droneOutputs?.[slot]
            const label = itemId ? (itemNameById.get(itemId) ?? itemId) : 'unassigned'
            return (
              <span
                key={slot}
                className={cn('base-drone-item absolute', onAssign && 'pointer-events-auto')}
                style={{ left: droneBayPositions[slot], top: 119, transform: `rotate(${-angle}deg)` }}
              >
                {itemId ? <AssetImage kind="items" id={itemId} width={28} alt="" /> : <Plus size={16} aria-hidden />}
                {onAssign ? (
                  <Button
                    isIconOnly
                    disableAnimation
                    disableRipple
                    variant="light"
                    className="nodrag nopan absolute inset-0 h-full min-h-0 w-full min-w-0 rounded-[10px] p-0"
                    aria-label={`Assign item to drone ${slot + 1}, currently ${label}`}
                    title={`Drone ${slot + 1}: ${label}. Click to assign.`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onPress={() => onAssign(slot)}
                  />
                ) : null}
              </span>
            )
          })}
        </div>
      </div>
      {droneOutputPorts(station).map((port) => {
        const [dx, dy] = faceSteps[port.face]
        const localX = port.x - station.position.x / CELL_SIZE
        const localY = port.y - station.position.y / CELL_SIZE
        return (
          <PortMarker
            key={port.slot}
            className="base-drone-port pointer-events-none absolute"
            face={port.face}
            flow="output"
            hovered={hoveredPort?.kind === 'port' && hoveredPort.x === localX && hoveredPort.y === localY && hoveredPort.face === port.face}
            style={{
              left: (localX + 0.5 - dx / 2) * CELL_SIZE,
              top: (localY + 0.5 - dy / 2) * CELL_SIZE,
            }}
            title={`Output ${port.slot + 1}: ${port.itemId ? (itemNameById.get(port.itemId) ?? port.itemId) : 'unassigned'}`}
          />
        )
      })}
    </>
  )
}

export function StationPreview({
  station,
  valid,
  corridors,
}: {
  station: BaseStation
  valid: boolean
  corridors: readonly StationCorridor[]
}) {
  const size = STATION_TYPES[station.type].footprintCells * CELL_SIZE
  return (
    <>
      {corridors.map((corridor) => (
        <div
          key={corridor.id}
          data-station-corridor-preview
          aria-hidden
          className={cn(
            'base-station-corridor base-station-corridor--preview pointer-events-none absolute',
            corridor.width < corridor.height ? 'base-station-corridor--horizontal' : 'base-station-corridor--vertical',
          )}
          style={{
            left: corridor.x * CELL_SIZE,
            top: corridor.y * CELL_SIZE,
            width: corridor.width * CELL_SIZE,
            height: corridor.height * CELL_SIZE,
          }}
        />
      ))}
      <div
        data-station-preview
        data-valid={valid}
        aria-hidden
        className={cn(
          'base-station base-station-preview pointer-events-none absolute',
          station.type === 'drone_station' && 'base-station--drone',
        )}
        style={{ left: station.position.x, top: station.position.y, width: size, height: size }}
      >
        <StationFrame station={station} corridors={corridors} />
        {station.type === 'drone_station' ? <DroneStationArtwork station={station} corridors={corridors} /> : null}
      </div>
    </>
  )
}
