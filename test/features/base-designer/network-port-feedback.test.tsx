// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { indexPlacements, type BasePlacement, type BaseStation } from '@/features/base-designer/lib/placement'
import { corridorLockPosition, getBeltEndAnchor } from '@/features/base-designer/lib/station-spatial'
import { machinePortFlow } from '@/features/base-designer/lib/connections'
import { connectedCorridors } from '@/features/base-designer/lib/stations'
import { BeltTile, MachineTile } from '@/features/base-designer/ui/station-node'
import { DroneStationArtwork } from '@/features/base-designer/ui/station-artwork'

const machine: BasePlacement = { id: 'machine', type: 'refinery', x: 2, y: 2, direction: 'east' }
const station: BaseStation = { id: 'floor', name: 'Floor', type: 'station_1x1', position: { x: 0, y: 0 }, placements: [], lockedTo: [] }
afterEach(cleanup)

describe('network port feedback', () => {
  it('keeps the box unassigned and neutral until a belt determines port direction', () => {
    const box: BasePlacement = { ...machine, type: 'container' }
    const view = render(<MachineTile placement={box} occupied={indexPlacements([box])} interactive onOpenItem={() => undefined} />)
    expect(view.container.querySelector('.base-machine-item-button')).toBeNull()
    expect(view.container.querySelectorAll('.base-machine-port[data-flow="unconnected"]')).toHaveLength(8)
    expect(view.container.querySelector('.base-machine-port svg')).toBeNull()
    const belt: BasePlacement = { id: 'belt', type: 'conveyor', x: 4, y: 2, direction: 'east', incoming: 'west' }
    view.rerender(<MachineTile placement={box} occupied={indexPlacements([box, belt])} />)
    expect(view.container.querySelectorAll('.base-machine-port[data-flow="output"]')).toHaveLength(1)
    expect(view.container.querySelector('.base-machine-port[data-flow="output"] svg')).toBeTruthy()
    view.rerender(<MachineTile placement={{ ...box, disabledOutputPorts: ['north:0'] }} occupied={indexPlacements([box])} />)
    expect(view.container.querySelector('.base-machine-port[data-flow="disabled-output"] svg')).toBeTruthy()
  })

  it('connects an outward belt on a valid machine port by default, preserving inward input behavior', () => {
    const belt: BasePlacement = { id: 'belt', type: 'conveyor', x: 5, y: 3, direction: 'east', incoming: 'west', routeId: 'route' }
    expect(machinePortFlow(indexPlacements([machine, belt]), machine, { face: 'east', offset: 1 })).toBe('output')
    const inward = { ...belt, direction: 'west' as const, incoming: 'east' as const }
    expect(machinePortFlow(indexPlacements([machine, inward]), machine, { face: 'east', offset: 1 })).toBe('input')
  })

  it('hits the terminal even from the adjacent cell, without accepting a closed wall', () => {
    const belt: BasePlacement = { id: 'belt', type: 'conveyor', x: 2, y: 1, direction: 'east', incoming: 'west', routeId: 'route' }
    const point = { clientX: 63, clientY: 30 }
    const bounds = { left: 0, top: 0, width: 280, height: 280 }
    const occupied = indexPlacements([belt])
    expect(getBeltEndAnchor(point, bounds, occupied, 14, 'conveyor', 'output', () => true)).toMatchObject({
      kind: 'port',
      x: 3,
      y: 1,
      face: 'east',
      routeId: 'route',
    })
    expect(getBeltEndAnchor(point, bounds, occupied, 14, 'conveyor', 'output', () => false)).toBeNull()
  })

  it('shows neutral ports without belts and an explicit blocked state after F', () => {
    const view = render(<MachineTile placement={machine} occupied={indexPlacements([machine])} />)
    expect(view.container.querySelectorAll('.base-machine-port[data-flow="unconnected"]')).toHaveLength(4)
    expect(view.container.querySelector('.base-machine-port svg')).toBeNull()
    view.rerender(<MachineTile placement={{ ...machine, disabledOutputPorts: ['north:1'] }} occupied={indexPlacements([machine])} />)
    expect(view.container.querySelectorAll('.base-machine-port[data-flow="disabled-output"]')).toHaveLength(1)
    expect(view.container.querySelectorAll('.base-machine-port[data-flow="unconnected"]')).toHaveLength(3)
  })

  it('marks only open route ends, with neutral rest state and matching hover feedback', () => {
    const first: BasePlacement = { id: 'a', type: 'conveyor', x: 1, y: 1, direction: 'east', incoming: 'west', routeId: 'route' }
    const last: BasePlacement = { ...first, id: 'b', x: 2 }
    const occupied = indexPlacements([first, last])
    const view = render(<BeltTile placement={last} occupied={occupied} canTraverse={() => true} />)
    expect(view.container.querySelectorAll('.base-belt-end')).toHaveLength(1)
    expect(view.container.querySelector('.base-belt-end')?.getAttribute('data-flow')).toBe('unconnected')
    view.rerender(
      <BeltTile
        placement={last}
        occupied={occupied}
        canTraverse={() => true}
        hoveredPort={{ kind: 'port', x: 3, y: 1, face: 'east', role: 'output', routeId: 'route' }}
      />,
    )
    expect(view.container.querySelector('.base-belt-end')?.getAttribute('data-hovered')).toBe('true')
    expect(view.container.querySelector('.base-belt-end svg')).toBeTruthy()
  })

  it('gives drone outlets the same output and hover states', () => {
    const drone: BaseStation = { ...station, type: 'drone_station' }
    const view = render(<DroneStationArtwork station={drone} hoveredPort={{ kind: 'port', x: 6, y: 14, face: 'south', role: 'output' }} />)
    expect(view.container.querySelectorAll('.base-drone-port[data-flow="output"]')).toHaveLength(2)
    expect(view.container.querySelectorAll('.base-drone-port[data-hovered="true"]')).toHaveLength(1)
  })

  it('mirrors both lock controls outside the passage', () => {
    const corridor = connectedCorridors([station, { ...station, id: 'other', position: { x: 320, y: 0 } }])[0]
    expect(corridorLockPosition(corridor, { x: 0, y: 0 }, undefined, 'far')).toEqual({ left: 300, top: 224 })
    expect(corridorLockPosition(corridor, { x: 0, y: 0 })).toEqual({ left: 300, top: 56 })
  })
})
