import { Group, Line, Rect, Text } from 'react-konva'
import { CELL_SIZE } from '../../model/scene'
import { SPLITTERS, TUNNELS, logisticsPorts, type Splitter, type Tunnel } from '../../model/logistics'
import { BuildingPortShape } from './building-port'
import { SceneElement } from './scene-element'
import { portBodyClip } from './port-geometry'
import { highlightFill } from './highlight'

/** Selection washes keep fixed I/O frames and tier labels clear. */
export function SplitterGraphic({
  splitter,
  selected = false,
  connected,
}: {
  splitter: Omit<Splitter, 'id'>
  selected?: boolean
  connected?: ReadonlySet<string>
}) {
  const ports = logisticsPorts({ splitters: [{ ...splitter, id: 'preview' }] }),
    color = selected ? '#f4b055' : undefined
  return (
    <>
      <Group name="splitter-art" x={10} y={10} offsetX={10} offsetY={10}>
        <Group
          clipFunc={portBodyClip(
            { x: -2, y: -2, width: 24, height: 24 },
            ports.filter((port) => connected?.has(port.key)),
            splitter,
          )}
        >
          <Rect x={1} y={1} width={18} height={18} cornerRadius={2} fill="#7c8f9a" stroke="#485f6b" strokeWidth={1} listening={false} />
          <Rect
            name="outline body-highlight"
            x={1}
            y={1}
            width={18}
            height={18}
            cornerRadius={2}
            fill={color ? highlightFill(color) : 'transparent'}
            stroke={color ?? 'transparent'}
            strokeWidth={1}
          />
          <Text
            x={3}
            y={5}
            width={14}
            text={`SPL\n${SPLITTERS[splitter.type].marking}`}
            align="center"
            fontFamily="Geist, sans-serif"
            fontSize={4.5}
            fontStyle="bold"
            lineHeight={1.1}
            fill="#263d46"
            listening={false}
          />
        </Group>
        {ports.map((port) => (
          <BuildingPortShape key={port.key} port={port} origin={splitter} role={port.role} connected={connected?.has(port.key) ?? false} />
        ))}
      </Group>
    </>
  )
}

/** Splitter artwork shares the canvas's explicit individual/group transformation contract. */
export function SplitterShape({
  splitter,
  selected,
  connected,
}: {
  splitter: Splitter
  selected: boolean
  connected: ReadonlySet<string>
}) {
  return (
    <SceneElement element={splitter} span={1} kind="splitter">
      <SplitterGraphic splitter={splitter} selected={selected} connected={connected} />
    </SceneElement>
  )
}

/** Both mouths share one selection and route; the buried guide is drawn only for creation/selection. */
export function TunnelGraphic({
  tunnel,
  showGuide = false,
  connected,
}: {
  tunnel: Omit<Tunnel, 'id'>
  showGuide?: boolean
  connected?: ReadonlySet<string>
}) {
  const ports = logisticsPorts({ tunnels: [{ ...tunnel, id: 'preview' }] }),
    color = showGuide ? '#f4b055' : undefined
  return (
    <>
      {showGuide ? (
        <Line
          name="tunnel-guide"
          points={[
            (tunnel.entry.x + 0.5) * CELL_SIZE,
            (tunnel.entry.y + 0.5) * CELL_SIZE,
            (tunnel.exit.x + 0.5) * CELL_SIZE,
            (tunnel.exit.y + 0.5) * CELL_SIZE,
          ]}
          stroke="#f4b055"
          strokeWidth={1.5}
          dash={[4, 4]}
          listening={false}
        />
      ) : null}
      {ports.map((port, i) => (
        <Group key={i} name={i === 0 ? 'tunnel-entry' : 'tunnel-exit'} x={port.at.x * CELL_SIZE} y={port.at.y * CELL_SIZE}>
          <Group clipFunc={portBodyClip({ x: -2, y: -2, width: 24, height: 24 }, connected?.has(port.key) ? [port] : [], port.at)}>
            <Group name="tunnel-hood" x={10} y={10} rotation={(Math.atan2(port.normal.y, port.normal.x) * 180) / Math.PI}>
              <Rect
                x={-8}
                y={-7}
                width={18}
                height={14}
                cornerRadius={2}
                fill="#7c8f9a"
                stroke="#485f6b"
                strokeWidth={1}
                listening={false}
              />
              <Rect
                name="outline body-highlight"
                x={-8}
                y={-7}
                width={18}
                height={14}
                cornerRadius={2}
                fill={color ? highlightFill(color) : 'transparent'}
                stroke={color ?? 'transparent'}
                strokeWidth={1}
              />
              <Line points={[5, -5, 5, 5]} stroke="#566c77" strokeWidth={1.2} lineCap="round" listening={false} />
            </Group>
          </Group>
          <BuildingPortShape port={port} origin={port.at} role={port.role} connected={connected?.has(port.key) ?? false} />
          <Text
            name="logistics-tier"
            x={4 - port.normal.x * 2}
            y={8 - port.normal.y * 2}
            width={12}
            align="center"
            text={TUNNELS[tunnel.type].marking}
            fontFamily="Geist, sans-serif"
            fontSize={4}
            fontStyle="bold"
            fill="#263d46"
            listening={false}
          />
        </Group>
      ))}
    </>
  )
}

/** A tunnel is selected from either mouth, while the guide never steals clicks from surface contents. */
export function TunnelShape({ tunnel, selected, connected }: { tunnel: Tunnel; selected: boolean; connected: ReadonlySet<string> }) {
  return (
    <Group
      name="viewport-element"
      selection={{ kind: 'tunnel', id: tunnel.id }}
      worldBounds={{
        x: Math.min(tunnel.entry.x, tunnel.exit.x) * CELL_SIZE,
        y: Math.min(tunnel.entry.y, tunnel.exit.y) * CELL_SIZE,
        width: (Math.abs(tunnel.exit.x - tunnel.entry.x) + 1) * CELL_SIZE,
        height: (Math.abs(tunnel.exit.y - tunnel.entry.y) + 1) * CELL_SIZE,
      }}
    >
      <TunnelGraphic tunnel={tunnel} showGuide={selected} connected={connected} />
    </Group>
  )
}
