// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BaseStation } from '@/features/base-designer/lib/placement'
import { connectedCorridors, droneOutputPorts, stationPreviewCorridors } from '@/features/base-designer/lib/stations'
import { canPlaceRouteInLayout } from '@/features/base-designer/lib/world-layout'
import { routeCells } from '@/features/base-designer/lib/route'
import { faceSteps } from '@/features/base-designer/lib/station-spatial'
import { corridorLockPosition } from '@/features/base-designer/lib/station-spatial'
import { StationPreview } from '@/features/base-designer/ui/station-artwork'

const station: BaseStation = { id: 'a', type: 'station_1x1', name: 'A', position: { x: 0, y: 0 }, lockedTo: [], placements: [] }
const preview: BaseStation = { ...station, id: 'preview', position: { x: 320, y: 0 } }
afterEach(cleanup)

describe('station connection preview', () => {
  it('matches committed corridors without inserting the preview into the layout', () => {
    const layout = [station]
    const corridors = stationPreviewCorridors(layout, preview)
    expect(corridors).toEqual(connectedCorridors([...layout, preview]))
    expect(corridors).toMatchObject([{ x: 14, y: 4, width: 2, height: 6 }])
    expect(layout).toEqual([station])
    const view = render(<StationPreview station={preview} valid corridors={corridors} />)
    const passage = view.container.querySelector<HTMLElement>('[data-station-corridor-preview]')
    expect(passage?.style.left).toBe('280px')
    expect(passage?.style.width).toBe('40px')
    view.rerender(<StationPreview station={preview} valid corridors={[]} />)
    expect(view.container.querySelector('[data-station-corridor-preview]')).toBeNull()
  })

  it('shows both aligned passages for 2x2 stations', () => {
    const large: BaseStation = { ...station, type: 'station_2x2_a' }
    const draft: BaseStation = { ...preview, type: 'station_2x2_b', position: { x: 640, y: 0 } }
    expect(stationPreviewCorridors([large], draft)).toMatchObject([
      { x: 30, y: 4, width: 2, height: 6 },
      { x: 30, y: 20, width: 2, height: 6 },
    ])
  })

  it('does not suggest floor for misalignment, a wrong gap or overlap', () => {
    for (const position of [
      { x: 320, y: 20 },
      { x: 340, y: 0 },
      { x: 260, y: 0 },
    ]) {
      expect(stationPreviewCorridors([station], { ...preview, position })).toEqual([])
    }
  })

  it('only joins the drone open face and draws no rectangular station frame around the drone', () => {
    const drone: BaseStation = { ...preview, type: 'drone_station', direction: 'west', position: { x: 300, y: 0 } }
    expect(stationPreviewCorridors([station], drone)).toHaveLength(1)
    expect(stationPreviewCorridors([station], { ...drone, direction: 'south' })).toEqual([])
    const view = render(<StationPreview station={drone} valid corridors={[]} />)
    expect(view.container.querySelector('.base-station-frame')).toBeNull()
    expect(view.container.querySelector('.base-drone-hull')).toBeTruthy()
    expect(stationPreviewCorridors([station], { ...drone, position: { x: 320, y: 0 } })).toEqual([])
    const connected = render(<StationPreview station={drone} valid corridors={stationPreviewCorridors([station], drone)} />)
    const passage = connected.container.querySelector<HTMLElement>('[data-station-corridor-preview]')
    expect(passage?.style.width).toBe('20px')
    expect(passage?.classList.contains('base-station-corridor--horizontal')).toBe(true)
  })

  it('parks horizontal and vertical lock controls outside the buildable passage', () => {
    const horizontal = stationPreviewCorridors([station], preview)[0]
    expect(corridorLockPosition(horizontal, { x: 0, y: 0 })).toEqual({ left: 300, top: 56 })
    expect(corridorLockPosition(horizontal, { x: 8, y: 3 })).toEqual({ left: 140, top: -4 })
    const vertical = stationPreviewCorridors([station], { ...preview, position: { x: 0, y: 320 } })[0]
    expect(corridorLockPosition(vertical, { x: 0, y: 0 })).toEqual({ left: 56, top: 300 })
    expect(corridorLockPosition(horizontal, { x: 0, y: 0 }).top + 14).toBeLessThan(horizontal.y * 20)
    expect(corridorLockPosition(vertical, { x: 0, y: 0 }).left + 14).toBeLessThan(vertical.x * 20)
  })

  it('keeps the lock target away from the neighboring floor and wall in a one-cell drone gap', () => {
    const horizontal = connectedCorridors([
      station,
      { ...preview, type: 'drone_station', direction: 'west', position: { x: 300, y: 0 } },
    ])[0]
    expect(corridorLockPosition(horizontal, { x: 0, y: 0 }, 'end')).toEqual({ left: 310, top: 56 })
    const vertical = { ...horizontal, x: 4, y: 14, width: 6, height: 1 }
    expect(corridorLockPosition(vertical, { x: 0, y: 0 }, 'start')).toEqual({ left: 56, top: 270 })
  })

  it('connects drone outlets through one-cell passages in every orientation, regardless of module order', () => {
    for (const direction of ['north', 'east', 'south', 'west'] as const) {
      const [dx, dy] = faceSteps[direction]
      const drone: BaseStation = { ...station, id: 'drone', type: 'drone_station', direction }
      const neighbor: BaseStation = { ...station, position: { x: dx * 300, y: dy * 300 } }
      const layout = [drone, neighbor]
      const corridors = connectedCorridors(layout)
      expect(corridors).toHaveLength(1)
      expect(corridors[0].width * corridors[0].height).toBe(6)
      expect(connectedCorridors([...layout].reverse())).toEqual(corridors)
      expect(stationPreviewCorridors([neighbor], drone)).toEqual(corridors)
      expect(connectedCorridors([drone, { ...neighbor, position: { x: dx * 320, y: dy * 320 } }])).toEqual([])
      const port = droneOutputPorts(drone)[0]
      expect(
        canPlaceRouteInLayout(
          layout,
          'drone',
          routeCells([
            { kind: 'floor', x: port.x, y: port.y },
            { kind: 'floor', x: port.x + dx * 3, y: port.y + dy * 3 },
          ]),
        ),
      ).toBe(true)
    }
  })
})
