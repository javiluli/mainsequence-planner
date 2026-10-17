import { Group, Image, Rect, Text } from 'react-konva'
import { dronePorts } from '../../lib/stations'
import type { DroneStation } from '../../model/scene'
import { BuildingPortShape } from './building-port'
import { portBodyClip } from './port-geometry'
import { ItemIcon } from './item-icon'

/** Cargo textures are view resources; changing a cargo never changes its stable catalog identity. */
function CargoIcon({ id, slot, rotation }: { id: string | null; slot: 0 | 1; rotation: number }) {
  return (
    <ItemIcon id={id} size={32} rotation={-rotation}>
      <Text
        x={-12}
        y={-8}
        width={24}
        align="center"
        text={String(slot + 1)}
        fontFamily="Geist, sans-serif"
        fontSize={16}
        fontStyle="bold"
        fill="#263d46"
      />
    </ItemIcon>
  )
}

/** Shared static hull and two interactive bays. The SVG rotation never changes logical outlets or the reserved footprint. */
export function DroneGraphic({
  station,
  image,
  connected,
  onOpenCargo,
  outlineColor = 'transparent',
}: {
  station: DroneStation
  image: CanvasImageSource | null
  connected?: ReadonlySet<string>
  onOpenCargo?: (slot: 0 | 1) => void
  outlineColor?: string
}) {
  const ports = dronePorts(station)
  return (
    <>
      <Group
        clipFunc={portBodyClip(
          { x: -5, y: -5, width: 290, height: 290 },
          ports.filter((port) => connected?.has(port.key)),
          station,
        )}
      >
        <Rect width={280} height={280} fill="#17191a" />
        <Group x={140} y={140} rotation={station.rotation}>
          {image ? <Image image={image} x={-144} y={-144} width={288} height={288} listening={false} /> : null}
          {([0, 1] as const).map((slot) => {
            const left = ((slot === 0 ? 36 : 197) - 140) * 1.12,
              top = (119 - 140) * 1.12
            return (
              <Group
                key={slot}
                x={left}
                y={top}
                listening={!!onOpenCargo}
                onMouseDown={(event) => {
                  if (event.evt.button === 0 && !event.evt.ctrlKey && !event.evt.metaKey && !event.evt.shiftKey) event.cancelBubble = true
                }}
                onClick={(event) => {
                  if (event.evt.button === 0 && !event.evt.ctrlKey && !event.evt.metaKey && !event.evt.shiftKey) {
                    event.cancelBubble = true
                    onOpenCargo?.(slot)
                  }
                }}
                onMouseEnter={(event) => {
                  event.target.getStage()!.container().style.cursor = 'pointer'
                }}
                onMouseLeave={(event) => {
                  event.target.getStage()!.container().style.cursor = ''
                }}
              >
                <Rect width={47 * 1.12} height={46 * 1.12} fill="rgba(0,0,0,0)" />
                <Group x={(47 * 1.12) / 2} y={(46 * 1.12) / 2}>
                  <CargoIcon id={station.cargo[slot]} slot={slot} rotation={station.rotation} />
                </Group>
              </Group>
            )
          })}
        </Group>
        <Rect name="outline" width={280} height={280} stroke={outlineColor} strokeWidth={2} strokeScaleEnabled={false} listening={false} />
      </Group>
      {ports.map((port) => (
        <BuildingPortShape key={port.key} port={port} origin={station} role="output" connected={connected?.has(port.key) ?? false} />
      ))}
    </>
  )
}
