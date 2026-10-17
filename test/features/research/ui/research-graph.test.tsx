// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { InternalNode, ReactFlowProps, ReactFlowState } from '@xyflow/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as researchLayout from '@/features/research/graph/lib/research-graph'
import type { ResearchFlowNode } from '@/features/research/graph/types'
import { ResearchGraph } from '@/features/research/ui/research-graph'

type MeasuredStore = Pick<ReactFlowState<ResearchFlowNode>, 'width' | 'height' | 'nodeLookup' | 'panZoom'>

const flow = vi.hoisted(() => ({
  nodes: [] as ResearchFlowNode[],
  ariaLabels: {} as NonNullable<ReactFlowProps<ResearchFlowNode>['ariaLabelConfig']>,
  fitView: vi.fn(),
  setCenter: vi.fn(),
  store: {
    width: 1200,
    height: 600,
    nodeLookup: new Map<string, InternalNode<ResearchFlowNode>>(),
    panZoom: {} as MeasuredStore['panZoom'],
  } satisfies MeasuredStore,
  reducedMotion: false,
}))

// React Flow's observer/store boundary is explicit: jsdom cannot measure canvas nodes.
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
    useReactFlow: () => ({
      fitView: flow.fitView,
      setCenter: flow.setCenter,
      getInternalNode: (id: string) => flow.store.nodeLookup.get(id),
    }),
    useStore: (selector: (state: MeasuredStore) => unknown) => selector(flow.store),
    ReactFlow: ({ nodes = [], children, onNodeClick, ariaLabelConfig }: ReactFlowProps<ResearchFlowNode>) => {
      flow.nodes = nodes
      flow.ariaLabels = ariaLabelConfig ?? {}
      return (
        <div>
          {nodes.map((node) => (
            <div
              key={node.id}
              role="button"
              tabIndex={0}
              className="react-flow__node"
              data-id={node.id}
              aria-label={node.ariaLabel}
              {...node.domAttributes}
              onClick={(event) => onNodeClick?.(event, node)}
            />
          ))}
          {children}
        </div>
      )
    },
    Controls: ({ fitViewOptions, onFitView }: ComponentProps<typeof actual.Controls>) => (
      <button
        aria-label="Fit research tree"
        onClick={() => {
          flow.fitView(fitViewOptions)
          onFitView?.()
        }}
      />
    ),
  }
})

/** Supplies a measurement batch, optionally retaining old dimensions or old graph identities. */
const measureGraph = ({ compactSelection = false, staleGraph = false } = {}) => {
  const previous = flow.store.nodeLookup
  flow.store.nodeLookup = new Map(
    flow.nodes.map((node) => [
      node.id,
      {
        ...node,
        measured:
          node.selected && !compactSelection
            ? { width: Math.round(Math.min(400, flow.store.width - 32)), height: 182 }
            : { width: 184, height: 56 },
        internals: {
          positionAbsolute: node.position,
          z: 0,
          handleBounds: { source: [], target: [] },
          userNode: staleGraph ? (previous.get(node.id)?.internals.userNode ?? node) : node,
        },
      },
    ]),
  )
}

/** Makes the initial overview measurable before testing a later user action. */
const renderOverview = () => {
  const view = render(<ResearchGraph />)
  measureGraph()
  view.rerender(<ResearchGraph />)
  flow.fitView.mockClear()
  return view
}

const searchTechnology = (name: string) => {
  const search = screen.getByRole('searchbox')
  fireEvent.change(search, { target: { value: name } })
  fireEvent.keyDown(search, { key: 'Enter' })
}

beforeEach(() => {
  flow.nodes = []
  flow.store.width = 1200
  flow.store.height = 600
  flow.store.nodeLookup = new Map()
  flow.reducedMotion = false
  flow.fitView.mockReset()
  flow.setCenter.mockReset()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: flow.reducedMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Research framing and keyboard interaction', () => {
  it('waits for expanded dimensions and centers search selection at native text scale', () => {
    const view = renderOverview()
    searchTechnology('Cobalt')
    measureGraph({ compactSelection: true })
    view.rerender(<ResearchGraph />)
    expect(flow.setCenter).not.toHaveBeenCalled()
    expect(flow.fitView).not.toHaveBeenCalled()

    measureGraph()
    view.rerender(<ResearchGraph />)
    const selected = flow.nodes.find((node) => node.selected)!
    expect(selected.id).toBe('RSC_CobaltRefining')
    expect(screen.getByRole('button', { name: 'Open Cobalt Refining research tree' })).toHaveAttribute('aria-pressed', 'true')
    expect(flow.setCenter).toHaveBeenCalledExactlyOnceWith(
      selected.position.x + 200,
      selected.position.y + 91,
      expect.objectContaining({ zoom: 1 }),
    )
    expect(flow.fitView).not.toHaveBeenCalled()
  })

  it('rejects measurements belonging to the preceding graph after switching technologies', () => {
    const view = renderOverview()
    searchTechnology('Cobalt')
    measureGraph()
    view.rerender(<ResearchGraph />)
    flow.setCenter.mockClear()
    searchTechnology('Advanced Circuits')
    measureGraph({ staleGraph: true })
    view.rerender(<ResearchGraph />)
    expect(flow.setCenter).not.toHaveBeenCalled()

    measureGraph()
    view.rerender(<ResearchGraph />)
    const selected = flow.nodes.find((node) => node.selected)!
    expect(selected.id).toBe('RSC_AdvancedCircuits')
    expect(flow.setCenter).toHaveBeenCalledExactlyOnceWith(
      selected.position.x + 200,
      selected.position.y + 91,
      expect.objectContaining({ zoom: 1 }),
    )
  })

  it('preserves explicit Fit across resize and reopens the same technology at readable scale', () => {
    const view = renderOverview()
    searchTechnology('Cobalt')
    measureGraph()
    view.rerender(<ResearchGraph />)
    flow.setCenter.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Fit research tree' }))
    expect(flow.fitView).toHaveBeenCalledTimes(1)

    flow.store.width = 390
    measureGraph()
    view.rerender(<ResearchGraph />)
    expect(flow.fitView).toHaveBeenCalledTimes(2)
    expect(flow.setCenter).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Open Cobalt Refining research tree' }))
    expect(flow.setCenter).toHaveBeenCalledTimes(1)
    flow.store.width = 320
    measureGraph()
    view.rerender(<ResearchGraph />)
    const selected = flow.nodes.find((node) => node.selected)!
    expect(flow.setCenter).toHaveBeenLastCalledWith(
      selected.position.x + 144,
      selected.position.y + 91,
      expect.objectContaining({ zoom: 1, duration: 0 }),
    )
    expect(flow.fitView).toHaveBeenCalledTimes(2)
  })

  it('does not reframe while typing or while current query measurements arrive', () => {
    const view = renderOverview()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Circuits' } })
    measureGraph()
    view.rerender(<ResearchGraph />)
    expect(flow.fitView).not.toHaveBeenCalled()
    expect(flow.setCenter).not.toHaveBeenCalled()
  })

  it('retains node focus for Space/Enter and returns focus to search with Escape and Back', () => {
    const view = renderOverview()
    const node = screen.getByRole('button', { name: 'Open Cobalt Refining research tree' })
    node.focus()
    fireEvent.keyDown(node, { key: ' ' })
    measureGraph()
    view.rerender(<ResearchGraph />)
    expect(node).toHaveFocus()
    const instructions = flow.ariaLabels['node.a11yDescription.keyboardDisabled']
    expect(instructions).toMatch(/Enter or Space/)
    expect(instructions).toMatch(/Escape to return to the overview/)
    expect(instructions).not.toMatch(/delete|arrow keys/i)
    expect(flow.ariaLabels['node.a11yDescription.default']).toBe(instructions)
    expect(screen.getByRole('button', { name: 'Back to overview' })).toBeInTheDocument()
    fireEvent.keyDown(node, { key: 'Escape' })
    measureGraph()
    view.rerender(<ResearchGraph />)
    expect(screen.getByRole('searchbox')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Back to overview' })).not.toBeInTheDocument()
    expect(flow.fitView).toHaveBeenCalledTimes(1)

    const nextNode = screen.getByRole('button', { name: 'Open Advanced Circuits research tree' })
    fireEvent.keyDown(nextNode, { key: 'Enter' })
    measureGraph()
    view.rerender(<ResearchGraph />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }))
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('uses an immediate selection viewport with reduced motion', () => {
    flow.reducedMotion = true
    const view = renderOverview()
    searchTechnology('Advanced Circuits')
    measureGraph()
    view.rerender(<ResearchGraph />)
    expect(flow.setCenter).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), { zoom: 1, duration: 0 })
  })

  it('does not queue viewport work for an empty graph', () => {
    vi.spyOn(researchLayout, 'buildResearchGraph').mockReturnValue({ nodes: [], edges: [], visibleCount: 0, matchedCount: 0 })
    const view = render(<ResearchGraph />)
    view.rerender(<ResearchGraph />)
    expect(flow.fitView).not.toHaveBeenCalled()
    expect(flow.setCenter).not.toHaveBeenCalled()
  })
})
