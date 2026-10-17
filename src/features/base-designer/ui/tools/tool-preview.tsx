import type Konva from 'konva'
import { memo, type RefObject } from 'react'
import { Circle, Group, Shape } from 'react-konva'
import { CELL_SIZE } from '../../model/scene'
import { BuildingGraphic } from '../elements/building'
import { BeltGraphic } from '../elements/belt'
import { SplitterGraphic, TunnelGraphic } from '../elements/logistics'
import { CorridorGraphic, StationGraphic } from '../elements/station'
import type { EditorTool } from '../../lib/tool-drafts'
import { GroupPreview } from './group-preview'

// Feedback and artwork renders must not replace native hover geometry; anchors and tier still update it.
const BeltPreview = memo(BeltGraphic)

/** One non-interactive ghost is reused for palette placement, clipboard placement and belt drafting. */
export function ToolPreview({
  tool,
  image,
  corridorImage,
  droneImage,
  groupRef,
}: {
  tool: EditorTool
  image: CanvasImageSource | null
  corridorImage: HTMLImageElement | null
  droneImage: CanvasImageSource | null
  groupRef: RefObject<Konva.Group | null>
}) {
  if (tool.kind === 'select') return null
  return (
    <Group ref={groupRef} visible={false} listening={false} opacity={0.65}>
      {tool.kind === 'place' ? (
        tool.item.kind === 'group' ? (
          <GroupPreview scene={tool.item.scene} image={image} corridorImage={corridorImage} droneImage={droneImage} />
        ) : tool.item.kind === 'station' ? (
          <>
            <StationGraphic image={image} droneImage={droneImage} station={{ ...tool.item, id: 'preview-station', x: 0, y: 0 }} />
            <CorridorGraphic image={corridorImage} />
          </>
        ) : tool.item.kind === 'building' ? (
          <BuildingGraphic building={{ ...tool.item, x: 0, y: 0, stationId: '' }} />
        ) : tool.item.kind === 'splitter' ? (
          <SplitterGraphic splitter={{ ...tool.item, x: 0, y: 0 }} />
        ) : tool.item.kind === 'tunnel' ? (
          <TunnelGraphic tunnel={tool.item} showGuide />
        ) : (
          <BeltPreview points={tool.item.points} heading={tool.item.heading} type={tool.item.type} showLevel />
        )
      ) : tool.kind === 'tunnel' ? (
        <TunnelGraphic
          tunnel={{ type: tool.type, entry: tool.entry ?? { x: 0, y: 0 }, exit: { x: (tool.entry?.x ?? 0) + 2, y: tool.entry?.y ?? 0 } }}
          showGuide
        />
      ) : (
        <>
          <BeltPreview
            points={tool.points}
            heading={tool.points.length === 1 ? tool.startNormal : undefined}
            startNormal={tool.startNormal}
            type={tool.extension ? tool.extension.type : tool.type}
            showLevel={tool.points.length > 0}
          />
          {tool.points.map((p, i) => (
            <Circle key={i} x={(p.x + 0.5) * CELL_SIZE} y={(p.y + 0.5) * CELL_SIZE} radius={3} fill="#f4b055" />
          ))}
          <Shape
            name="anchor-cursor"
            width={24}
            height={24}
            offsetX={12}
            offsetY={12}
            radius={8}
            fill="#f4b055"
            stroke="#84949e"
            strokeWidth={1}
            sceneFunc={(context, shape) => {
              // The free pointer keeps its orange core; an exact socket hit adds the reference's small ring.
              if (shape.getAttr('overPort')) {
                context.beginPath()
                context.arc(12, 12, shape.getAttr('radius'), 0, Math.PI * 2)
                context.setAttr('fillStyle', '#181716')
                context.fill()
                context.strokeShape(shape)
              }
              context.beginPath()
              context.arc(12, 12, 4.5, 0, Math.PI * 2)
              context.fillShape(shape)
            }}
          />
        </>
      )}
    </Group>
  )
}
