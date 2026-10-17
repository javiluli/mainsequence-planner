import { Shape } from 'react-konva'
import type { BuildingPort } from '../../model/buildings'
import { CELL_SIZE, type Point } from '../../model/scene'
import { PORT_DEPTH, PORT_INSET, PORT_SPAN, socketPath, socketOutline } from './port-geometry'

/** Shared 17x4.5px frame with a half-depth seat; clipping and hit artwork never alter logical connections.
 * This exact Shape carries portCell in world cells and portNormal as an outward cardinal vector.
 * portKey identifies inspection; optional outputKey identifies the output F may request to toggle.
 * Selection belongs to the owning scene ancestor, while pixel placement alone applies CELL_SIZE and the local origin.
 */
export function BuildingPortShape({
  port,
  origin,
  role,
  connected = !!role,
}: {
  port: BuildingPort
  origin: Point
  role?: 'input' | 'output'
  connected?: boolean
}) {
  const color = port.outputEnabled === false ? '#ef4444' : role === 'input' ? '#55c2ba' : role === 'output' ? '#f4b055' : '#bac6ce'
  return (
    <Shape
      name="port-frame"
      width={PORT_DEPTH}
      height={PORT_SPAN}
      offsetX={PORT_INSET}
      offsetY={PORT_SPAN / 2}
      x={(port.position.x - origin.x) * CELL_SIZE}
      y={(port.position.y - origin.y) * CELL_SIZE}
      rotation={(Math.atan2(port.normal.y, port.normal.x) * 180) / Math.PI}
      fill={color}
      portCell={port.cell}
      portNormal={port.normal}
      portKey={port.key}
      outputKey={port.outputKey}
      outputEnabled={port.outputEnabled}
      sceneFunc={(context, shape) => {
        const path = socketOutline(connected)
        if (path) {
          // Ports have solid palette fills. Hit painting retains Konva's separate color-key path.
          context.setAttr('fillStyle', shape.fill())
          context._context.fill(path)
          return
        }
        socketPath(context, connected)
        context.fillShape(shape)
      }}
      hitFunc={(context, shape) => {
        // Fill the aperture too, keeping the rounded corners clear for neighboring sockets.
        socketPath(context, false)
        context.fillShape(shape)
      }}
    />
  )
}
