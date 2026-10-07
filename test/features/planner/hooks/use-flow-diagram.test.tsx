// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useFlowDiagram } from '@/features/planner/hooks/use-flow-diagram'
import { planToFlow, type ProductionFlowLayout } from '@/features/planner/flow/plan-to-flow'
import { buildProductionPlan, type ProductionPlan } from '@/features/planner/lib/production-plan'
import { buildings, items, producerBuildingsByItemId } from '@/shared/data'

const buildPlan = (targetIpm: number) =>
  buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId: 'T_CobaltPlates',
    targetIpm,
    isRawTarget: false,
    supplyCountByItem: {},
  })

interface DiagramProps {
  plan: ProductionPlan | null
  layoutMode: ProductionFlowLayout
}

afterEach(cleanup)

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
})
