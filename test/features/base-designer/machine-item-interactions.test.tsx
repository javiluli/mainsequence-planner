// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BaseStation } from '@/features/base-designer/lib/placement'
import { indexPlacements } from '@/features/base-designer/lib/placement'
import { useStationInteractions } from '@/features/base-designer/ui/use-station-interactions'
import { MachineTile } from '@/features/base-designer/ui/station-node'

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
    onPasteHover: vi.fn(),
    onPasteLeave: vi.fn(),
    onPasteCell: vi.fn(),
    onActivate: vi.fn(),
    onCell: vi.fn(),
    onPickTool: vi.fn(),
    onAreaSelect: vi.fn(),
    onMoveArea: vi.fn(() => true),
    onSelectionPreview: vi.fn(),
    onClearSelectionPreview: vi.fn(),
    onRouteHover: vi.fn(),
    onMovePlacement: vi.fn(() => true),
    onMoveRoute: vi.fn(() => true),
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
      tabIndex={0}
      onPointerMove={handlers.handlePointerMove}
      onKeyDown={handlers.handleKeyDown}
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
  it('keeps the hovered port after an output toggle so F can toggle it again without pointer movement', () => {
    const input = data()
    const view = render(<Grid input={input} />)
    const grid = screen.getByTestId('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 280))
    const move = new MouseEvent('pointermove', { bubbles: true, clientX: 70, clientY: 43 })
    Object.defineProperty(move, 'isPrimary', { value: true })
    fireEvent(grid, move)
    fireEvent.keyDown(grid, { key: 'f' })
    expect(input.onToggleMachineOutput).toHaveBeenCalledWith('floor', 'refinery', 'north', 1)
    const updated = { ...station, placements: [{ ...station.placements[0], disabledOutputPorts: ['north:1'] }] }
    view.rerender(<Grid input={{ ...input, station: updated, layoutStations: [updated] }} />)
    fireEvent.keyDown(grid, { key: 'f' })
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

  it.each(['conveyor', 'erase'] as const)('right-click cancels the %s tool without clearing a product', (tool) => {
    const input = data({ tool })
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
