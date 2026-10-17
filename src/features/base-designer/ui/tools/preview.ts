import type Konva from 'konva'
import { CELL_SIZE, type Point, type Scene } from '../../model/scene'
import type { Tunnel } from '../../model/logistics'
import { stationCorridors } from '../../lib/stations'
import { canPlaceTunnel, canStartTunnel, beltPlacementIssue, tunnelPlacementIssue } from '../../lib/placement'
import { beltConnections, beltToExtend, containsBeltCell } from '../../lib/belts'
import { placementIssue, placementAt } from '../../lib/clipboard'
import { beltDraftPoints, proposeBeltDraft, tunnelDraft, toolPoint, type EditorTool } from '../../lib/tool-drafts'
import { beltLevelPosition, beltPixels, roundedBeltPath } from '../elements/belt-geometry'
import { checkGroupPlacement } from '../../lib/clipboard-group'
import { paintHighlights } from '../elements/highlight'

/** Hover changes native preview pixels only; tool state changes only when an anchor or edit is confirmed. */
export function paintPreview(group: Konva.Group, tool: EditorTool, scene: Scene, world: Point, port?: Point, normal?: Point) {
  if (tool.kind === 'select') {
    group.visible(false)
    return
  }
  const point = toolPoint(tool, world, port)
  let valid: boolean
  let issue: string | null
  if (tool.kind === 'place') {
    if (tool.item.kind === 'group') {
      const checked = checkGroupPlacement(scene, tool.item.scene, point),
        proposal = checked.additions
      valid = !!proposal
      group.position({ x: point.x * CELL_SIZE, y: point.y * CELL_SIZE })
      if (proposal) {
        const ids = new Set(proposal.stations.map((station) => station.id))
        const corridors = stationCorridors([...scene.stations, ...proposal.stations])
          .filter((corridor) => corridor.stationIds.some((id) => ids.has(id)))
          .map((corridor) => ({ ...corridor, x: corridor.x - point.x, y: corridor.y - point.y }))
        group.findOne<Konva.Shape>('.station-corridors')?.setAttrs({ corridors })
      } else {
        group.findOne<Konva.Shape>('.station-corridors')?.setAttrs({ corridors: stationCorridors(tool.item.scene.stations) })
      }
      paintHighlights(group, valid ? '#f4b055' : '#ef7373')
      group.visible(true)
      return checked.issue
    }
    const placement = placementAt(scene, tool.item, point)
    issue = placementIssue(scene, placement)
    valid = !issue
    const position = placement.kind === 'station' ? placement.value : point
    group.position({ x: position.x * CELL_SIZE, y: position.y * CELL_SIZE })
    if (placement.kind === 'splitter' && tool.item.kind === 'splitter')
      group.findOne<Konva.Group>('.splitter-art')?.rotation(placement.value.rotation - tool.item.rotation)
    if (placement.kind === 'station') {
      const draft = { id: 'preview-station', ...position }
      const corridors = stationCorridors([...scene.stations, draft])
        .filter((corridor) => corridor.stationIds.includes(draft.id))
        .map((corridor) => ({ ...corridor, x: corridor.x - position.x, y: corridor.y - position.y }))
      group.findOne<Konva.Shape>('.station-corridors')?.setAttrs({
        corridors,
        previewStationId: draft.id,
        previewColor: valid ? '#f4b055' : '#ef7373',
      })
    }
  } else if (tool.kind === 'tunnel') {
    const draft = tunnelDraft(tool, point)
    group.position({ x: 0, y: 0 })
    valid = tool.entry ? canPlaceTunnel(scene, draft) : canStartTunnel(scene, point)
    issue = valid ? null : tool.entry ? tunnelPlacementIssue(scene, draft) : 'Choose a free floor cell for the underground entry.'
    paintTunnel(group, draft, !!tool.entry)
  } else {
    const last = tool.points.at(-1)
    const draft = proposeBeltDraft(tool, scene, point, normal)
    // Idle hover validates a possible start but draws no belt until the first anchor is accepted.
    const points = last ? draft.points : []
    const extension = !last ? beltToExtend(scene, point) : undefined
    valid = !!extension || draft.valid
    issue = valid
      ? null
      : beltPlacementIssue(
          scene,
          { points: beltDraftPoints(tool, draft.points), ...(draft.heading && { heading: draft.heading }) },
          tool.extension?.id,
        )
    group.position({ x: 0, y: 0 })
    const heading = last ? draft.heading : undefined
    const previous = tool.extension?.points.at(-2),
      first = points[0]
    const extensionHeading = previous && first ? { x: Math.sign(first.x - previous.x), y: Math.sign(first.y - previous.y) } : undefined
    // Direction is decorative until a second anchor or a real one-cell connection determines it.
    const visualHeading =
      points.length === 1 ? (heading ?? tool.startNormal ?? tool.extension?.heading ?? extensionHeading ?? { x: 1, y: 0 }) : heading
    const connections = last
      ? beltConnections(scene, { id: tool.extension?.id ?? '', points: beltDraftPoints(tool, points), heading: visualHeading })
      : undefined
    const inputPosition = connections?.input?.port.position ?? connections?.logisticsInput?.position
    const outputPosition = tool.extension
      ? undefined
      : (connections?.output?.port.position ?? connections?.logisticsOutput?.position ?? connections?.droneOutput?.position)
    const junctions = points.filter(
      (p, i) => (i === 0 || i === points.length - 1) && scene.belts.some((belt) => containsBeltCell(belt.points, p)),
    )
    const pixels = beltPixels(points, visualHeading, inputPosition, outputPosition, junctions)
    const offset = points.length
      ? -Math.abs(pixels[0] - (points[0].x + 0.5) * CELL_SIZE) - Math.abs(pixels[1] - (points[0].y + 0.5) * CELL_SIZE)
      : 0
    const geometry = [roundedBeltPath(pixels, offset, junctions)]
    group.findOne<Konva.Text>('.belt-level')?.position(beltLevelPosition(points.length ? points : [point], tool.startNormal ?? normal))
    for (const shape of group.find<Konva.Shape>('.route-line')) shape.setAttrs({ geometry })
    const joining = valid && (extension || scene.belts.some((b) => b.id !== tool.extension?.id && containsBeltCell(b.points, point)))
    group.findOne<Konva.Shape>('.anchor-cursor')?.setAttrs({
      x: world.x,
      y: world.y,
      radius: joining ? 10 : 8,
      stroke: !valid ? '#ef7373' : joining ? '#f4b055' : '#84949e',
      strokeWidth: joining ? 1.5 : 1,
    })
  }
  paintHighlights(group, valid ? '#f4b055' : '#ef7373')
  group.findOne<Konva.Shape>('.anchor-cursor')?.fill(valid ? '#f4b055' : '#ef7373')
  group.visible(true)
  return issue
}

/** Hover moves two native mouths and their guide; React only stores the first confirmed click. */
function paintTunnel(group: Konva.Group, tunnel: Omit<Tunnel, 'id'>, hasEntry: boolean) {
  let heading = { x: Math.sign(tunnel.exit.x - tunnel.entry.x), y: Math.sign(tunnel.exit.y - tunnel.entry.y) }
  if (!heading.x && !heading.y) heading = { x: 1, y: 0 }
  for (const [i, cell] of [tunnel.entry, tunnel.exit].entries()) {
    const mouth = group.findOne<Konva.Group>(i === 0 ? '.tunnel-entry' : '.tunnel-exit')
    if (!mouth) continue
    const normal = i === 0 ? { x: -heading.x, y: -heading.y } : heading
    const angle = (Math.atan2(normal.y, normal.x) * 180) / Math.PI
    mouth.position({ x: cell.x * CELL_SIZE, y: cell.y * CELL_SIZE })
    mouth.visible(i === 0 || hasEntry)
    mouth.findOne<Konva.Group>('.tunnel-hood')?.rotation(angle)
    mouth.findOne<Konva.Text>('.logistics-tier')?.position({ x: 8 - normal.x * 5, y: 7 - normal.y * 5 })
    mouth.findOne<Konva.Shape>('.port-frame')?.setAttrs({
      x: (0.5 + normal.x * 0.5) * CELL_SIZE,
      y: (0.5 + normal.y * 0.5) * CELL_SIZE,
      rotation: angle,
    })
  }
  group.findOne<Konva.Line>('.tunnel-guide')?.setAttrs({
    visible: hasEntry,
    points: [
      (tunnel.entry.x + 0.5) * CELL_SIZE,
      (tunnel.entry.y + 0.5) * CELL_SIZE,
      (tunnel.exit.x + 0.5) * CELL_SIZE,
      (tunnel.exit.y + 0.5) * CELL_SIZE,
    ],
  })
}
