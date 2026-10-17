import type { ReactNode } from 'react'
import { Group } from 'react-konva'
import { CELL_SIZE, STATION_CELLS, type Point, type Selection } from '../../model/scene'

/** Artwork owns identity and logical bounds; the canvas owns the shared individual/group drag gesture. */
export function SceneElement({
  element,
  span = STATION_CELLS,
  kind,
  children,
}: {
  element: Point & { id: string }
  span?: number
  kind: Selection['kind']
  children: ReactNode
}) {
  return (
    <Group
      name={`${kind} viewport-element`}
      selection={{ kind, id: element.id }}
      worldBounds={{ x: element.x * CELL_SIZE, y: element.y * CELL_SIZE, width: span * CELL_SIZE, height: span * CELL_SIZE }}
      x={element.x * CELL_SIZE}
      y={element.y * CELL_SIZE}
    >
      {children}
    </Group>
  )
}
