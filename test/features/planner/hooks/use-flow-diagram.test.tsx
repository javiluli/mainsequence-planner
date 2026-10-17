// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InternalNode, ReactFlowState } from '@xyflow/react'
import type { PlannerFlowNode } from '@/features/planner/flow/types'
import { useFlowDiagram } from '@/features/planner/hooks/use-flow-diagram'
import { planToFlow, type ProductionFlowLayout } from '@/features/planner/flow/plan-to-flow'
import { buildProductionPlan, type ProductionPlan } from '@/features/planner/lib/production-plan'
import { buildings, items, producerBuildingsByItemId } from '@/shared/data'

const viewport = vi.hoisted(() => ({
  fitView: vi.fn(),
  reduceMotion: false,
  state: { panZoom: {}, nodeLookup: new Map<string, InternalNode<PlannerFlowNode>>() },
}))

// jsdom cannot measure nodes; keep the installed change adapter and control only the viewport boundary.
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useReactFlow: () => ({ fitView: viewport.fitView }),
  useStore: (selector: (state: Pick<ReactFlowState<PlannerFlowNode>, 'panZoom' | 'nodeLookup'>) => unknown) =>
    selector(viewport.state as Pick<ReactFlowState<PlannerFlowNode>, 'panZoom' | 'nodeLookup'>),
}))
/** Produces a completed observer batch, with optional data from a superseded graph. */
const measureNodes = (nodes: readonly PlannerFlowNode[], staleNodes: readonly PlannerFlowNode[] = []) => {
  viewport.state.nodeLookup = new Map(
    nodes.map((node) => [
      node.id,
      {
        ...node,
        measured: { width: 200, height: 100 },
        internals: {
          userNode: staleNodes.find((previous) => previous.id === node.id) ?? node,
          positionAbsolute: node.position,
          z: 0,
          handleBounds: { source: [], target: [] },
        },
      },
    ]),
  )
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: viewport.reduceMotion }))
  viewport.fitView.mockReset()
  viewport.state.nodeLookup = new Map()
  viewport.reduceMotion = false
})
const buildPlan = (targetIpm: number, targetId = 'T_CobaltPlates') =>
  buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId,
    targetIpm,
    isRawTarget: false,
    supplyCountByItem: {},
  })

interface DiagramProps {
  plan: ProductionPlan | null
  layoutMode: ProductionFlowLayout
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useFlowDiagram', () => {
  it('preserves local node changes for the same plan and resets them when the production rate changes', () => {
    const plan = buildPlan(15)
    const { result, rerender } = renderHook((props: DiagramProps) => useFlowDiagram({ items, ...props }), {
      initialProps: { plan, layoutMode: 'network' },
      wrapper: ReactFlowProvider,
    })
    const nodeId = result.current.nodes[0].id
    const position = { x: 1234, y: 5678 }
    act(() => result.current.onNodesChange([{ id: nodeId, type: 'position', position }]))
    rerender({ plan, layoutMode: 'network' })
    expect(result.current.nodes.find((node) => node.id === nodeId)?.position).toEqual(position)

    const nextPlan = buildPlan(30)
    rerender({ plan: nextPlan, layoutMode: 'network' })
    const expected = planToFlow({ plan: nextPlan, items, layoutMode: 'network' })
    expect(result.current.nodes).toEqual(expected.nodes)
    expect(result.current.edges).toEqual(expected.edges)
  })

  it('rebuilds the layout and clears nodes and edges when the plan is removed', () => {
    const plan = buildPlan(15)
    const { result, rerender } = renderHook((props: DiagramProps) => useFlowDiagram({ items, ...props }), {
      initialProps: { plan, layoutMode: 'network' },
      wrapper: ReactFlowProvider,
    })
    rerender({ plan, layoutMode: 'stages' })
    const expected = planToFlow({ plan, items, layoutMode: 'stages' })
    expect(result.current.nodes).toEqual(expected.nodes)
    expect(result.current.edges).toEqual(expected.edges)

    rerender({ plan: null, layoutMode: 'stages' })
    expect(result.current.nodes).toEqual([])
    expect(result.current.edges).toEqual([])
  })

  it('fits the initial graph only when current model dimensions and handles exist', () => {
    const plan = buildPlan(15)
    const props: DiagramProps = { plan, layoutMode: 'network' }
    const { result, rerender } = renderHook((input: DiagramProps) => useFlowDiagram({ items, ...input }), {
      initialProps: props,
      wrapper: ReactFlowProvider,
    })
    expect(viewport.fitView).not.toHaveBeenCalled()
    expect(result.current.isMeasured).toBe(false)
    measureNodes(result.current.nodes)
    rerender(props)
    expect(viewport.fitView).toHaveBeenCalledExactlyOnceWith({ padding: 0.08, duration: 0 })
    expect(result.current.isMeasured).toBe(true)
    rerender(props)
    expect(viewport.fitView).toHaveBeenCalledTimes(1)
  })

  it('rejects old graph measurements during layout changes and uses immediate fit with reduced motion', () => {
    const plan = buildPlan(15)
    const props: DiagramProps = { plan, layoutMode: 'network' }
    const { result, rerender } = renderHook((input: DiagramProps) => useFlowDiagram({ items, ...input }), {
      initialProps: props,
      wrapper: ReactFlowProvider,
    })
    const previousNodes = result.current.nodes
    measureNodes(previousNodes)
    rerender(props)
    viewport.fitView.mockClear()
    viewport.reduceMotion = true
    const stages: DiagramProps = { plan, layoutMode: 'stages' }
    rerender(stages)
    measureNodes(result.current.nodes, previousNodes)
    rerender(stages)
    expect(viewport.fitView).not.toHaveBeenCalled()
    expect(result.current.isMeasured).toBe(false)
    measureNodes(result.current.nodes)
    rerender(stages)
    expect(viewport.fitView).toHaveBeenCalledExactlyOnceWith({ padding: 0.08, duration: 0 })
    expect(result.current.isMeasured).toBe(true)
  })

  it('fits only the latest target after rapid changes and ignores an obsolete edit callback', () => {
    const initial: DiagramProps = { plan: buildPlan(15), layoutMode: 'network' }
    const { result, rerender, unmount } = renderHook((input: DiagramProps) => useFlowDiagram({ items, ...input }), {
      initialProps: initial,
      wrapper: ReactFlowProvider,
    })
    const obsoleteEdit = result.current.onNodesChange
    const obsoleteId = result.current.nodes[0].id
    measureNodes(result.current.nodes)
    rerender(initial)
    viewport.fitView.mockClear()
    rerender({ plan: buildPlan(15, items.find((item) => item.name === 'Hydrogen Fuel')!.id), layoutMode: 'network' })
    const supersededNodes = result.current.nodes
    const latest: DiagramProps = { plan: buildPlan(15, items.find((item) => item.name === 'Exosuit')!.id), layoutMode: 'network' }
    rerender(latest)
    const expectedNodes = result.current.nodes
    act(() => obsoleteEdit([{ id: obsoleteId, type: 'position', position: { x: 9999, y: 9999 } }]))
    expect(result.current.nodes).toEqual(expectedNodes)
    measureNodes(result.current.nodes, supersededNodes)
    rerender(latest)
    expect(viewport.fitView).not.toHaveBeenCalled()
    expect(result.current.isMeasured).toBe(false)
    measureNodes(result.current.nodes)
    rerender(latest)
    expect(viewport.fitView).toHaveBeenCalledTimes(1)
    viewport.fitView.mockClear()
    rerender({ plan: null, layoutMode: 'network' })
    expect(result.current.nodes).toEqual([])
    expect(result.current.isMeasured).toBe(true)
    unmount()
    expect(viewport.fitView).not.toHaveBeenCalled()
  })
})
