// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BaseStation } from '@/features/base-designer/lib/layout/placement'
import { indexPlacements } from '@/features/base-designer/lib/layout/placement'
import { useStationInteractions } from '@/features/base-designer/ui/nodes/use-station-interactions'
import { MachineTile } from '@/features/base-designer/ui/artwork/machine-tile'
import { StationNode } from '@/features/base-designer/ui/nodes/station-node'
import type { StationNodeData } from '@/features/base-designer/model/station-node'

const station: BaseStation = {
  id: 'floor',
  name: 'Floor',
  type: 'station_1x1',
  position: { x: 0, y: 0 },
  lockedTo: [],
  placements: [{ id: 'refinery', type: 'refinery', x: 2, y: 2, direction: 'east', recipeId: 'cobalt_plates' }],
}

type InteractionData = Parameters<typeof useStationInteractions>[0]
function data(overrides: Partial<InteractionData> = {}): InteractionData {
  return {
    station,
    layoutStations: [station],
    worldPieces: [],
    externalPlacements: [],
    interactionRevision: 0,
    tool: 'select',
    selectedAreaIds: new Set(),
    selectionPreview: null,
    pasteActive: false,
    routeDraft: null,
    onActivate: vi.fn(),
    onSelectStation: vi.fn(),
    onCell: vi.fn(),
    onPickTool: vi.fn(),
    onAreaSelect: vi.fn(),
    onTransformPlacements: vi.fn(() => true),
    onSelectionPreview: vi.fn(),
    onClearSelectionPreview: vi.fn(),
    onRouteHover: vi.fn(),
    onToggleMachineOutput: vi.fn(),
    onClearMachineItem: vi.fn(),
    onReleaseTool: vi.fn(),
    ...overrides,
  }
}
function Grid({ input }: { input: InteractionData }) {
  const handlers = useStationInteractions(input, () => true)
  return (
    <div
      data-testid="grid"
      onPointerDown={handlers.handlePointerDown}
      onPointerUp={handlers.handlePointerUp}
      onPointerMove={handlers.handlePointerMove}
      onContextMenu={handlers.handleContextMenu}
    />
  )
}
function rightClick(input: InteractionData) {
  render(<Grid input={input} />)
  const grid = screen.getByTestId('grid')
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 280))
  fireEvent.contextMenu(grid, { clientX: 50, clientY: 50, button: 2 })
}

afterEach(cleanup)
describe('machine product gestures', () => {
  it('does not let a completed grid click toggle React Flow selection for a second time', () => {
    const outerClick = vi.fn()
    const nodeData: StationNodeData = {
      ...data(),
      layoutCorridors: [],
      worldPreviewRoute: [],
      animatedBelts: new Map(),
      droneSourceCells: new Set(),
      active: true,
      selectedPlacementId: null,
      selectedRouteId: null,
      routePreviewValid: false,
      onOpenDroneOutput: vi.fn(),
      onOpenMachineItem: vi.fn(),
      onToggleStationLock: vi.fn(),
    }
    const view = render(
      <div onClick={outerClick}>
        <StationNode
          id="floor"
          type="station"
          data={nodeData}
          selected={false}
          draggable
          selectable
          deletable
          isConnectable={false}
          dragging={false}
          zIndex={0}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
        />
      </div>,
    )
    const grid = view.container.querySelector('.base-station-grid')
    expect(grid).not.toBeNull()
    fireEvent.click(grid!, { shiftKey: true })
    expect(outerClick).not.toHaveBeenCalled()
  })
  it('uses Shift-click for additive station selection, but Shift-drag still selects pieces', () => {
    const piece = station.placements[0]
    const input = data({ worldPieces: [{ ...piece, stationId: station.id }] })
    render(<Grid input={input} />)
    const grid = screen.getByTestId('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 280))
    Object.defineProperties(grid, {
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: vi.fn() },
    })
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, shiftKey: true })
      Object.defineProperties(event, { isPrimary: { value: true }, pointerId: { value: 1 } })
      fireEvent(grid, event)
    }
    pointer('pointerdown', 50, 50)
    pointer('pointerup', 50, 50)
    expect(input.onSelectStation).toHaveBeenCalledWith('floor', true)
    expect(input.onAreaSelect).not.toHaveBeenCalled()
    pointer('pointerdown', 50, 50)
    pointer('pointermove', 80, 80)
    pointer('pointerup', 80, 80)
    expect(input.onSelectStation).toHaveBeenCalledOnce()
    expect(input.onAreaSelect).toHaveBeenCalledWith(['refinery'])
  })
  it('publishes the hovered output command again after a toggle without pointer movement', () => {
    const publish = vi.fn<(execute: () => void) => () => void>(() => () => {})
    const input = data({ onOutputCommand: publish })
    const view = render(<Grid input={input} />)
    const grid = screen.getByTestId('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 280))
    const move = new MouseEvent('pointermove', { bubbles: true, clientX: 70, clientY: 43 })
    Object.defineProperty(move, 'isPrimary', { value: true })
    fireEvent(grid, move)
    publish.mock.lastCall?.[0]()
    expect(input.onToggleMachineOutput).toHaveBeenCalledWith('floor', 'refinery', 'north', 1)
    const updated = { ...station, placements: [{ ...station.placements[0], disabledOutputPorts: ['north:1'] }] }
    view.rerender(<Grid input={{ ...input, station: updated, layoutStations: [updated] }} />)
    publish.mock.lastCall?.[0]()
    expect(input.onToggleMachineOutput).toHaveBeenCalledTimes(2)
  })

  it('hides the add-product control for assigned machines and restores it when cleared', () => {
    const placement = station.placements[0]
    const view = render(<MachineTile occupied={indexPlacements([])} placement={placement} interactive onOpenItem={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Choose product for Refinery' })).toBeNull()
    view.rerender(
      <MachineTile occupied={indexPlacements([])} placement={{ ...placement, recipeId: undefined }} interactive onOpenItem={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Choose product for Refinery' })).toBeTruthy()
  })

  it('clears only the clicked machine product in Select mode', () => {
    const input = data()
    rightClick(input)
    expect(input.onClearMachineItem).toHaveBeenCalledWith('floor', 'refinery')
    expect(input.onReleaseTool).not.toHaveBeenCalled()
  })

  it('right-click cancels the conveyor tool without clearing a product', () => {
    const input = data({ tool: 'conveyor' })
    rightClick(input)
    expect(input.onClearMachineItem).not.toHaveBeenCalled()
    expect(input.onReleaseTool).toHaveBeenCalledOnce()
  })

  it('cancels a paste preview without clearing the machine underneath', () => {
    const input = data({ pasteActive: true })
    rightClick(input)
    expect(input.onClearMachineItem).not.toHaveBeenCalled()
    expect(input.onReleaseTool).toHaveBeenCalledOnce()
  })
})
