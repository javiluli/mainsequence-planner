import { describe, expect, it } from 'vitest'
import type { PlannerFlowEdge } from '../types'
import { getFlowNeighborhood } from './flow-neighborhood'

const edges: PlannerFlowEdge[] = [
  { id: 'ore-ingot', type: 'productionEdge', source: 'ore', target: 'ingot' },
  { id: 'ingot-plate', type: 'productionEdge', source: 'ingot', target: 'plate' },
  { id: 'plate-machine', type: 'productionEdge', source: 'plate', target: 'machine' },
  { id: 'fuel-machine', type: 'productionEdge', source: 'fuel', target: 'machine' },
]

describe('flow neighborhood', () => {
  it('includes direct predecessors and successors, but not a second hop', () => {
    const neighborhood = getFlowNeighborhood('ingot', edges)

    expect(neighborhood?.nodeIds).toEqual(new Set(['ingot', 'ore', 'plate']))
    expect(neighborhood?.edgeIds).toEqual(new Set(['ore-ingot', 'ingot-plate']))
  })

  it('keeps an isolated node visible and supports clearing the focus', () => {
    expect(getFlowNeighborhood('isolated', edges)?.nodeIds).toEqual(new Set(['isolated']))
    expect(getFlowNeighborhood(null, edges)).toBeNull()
  })
})
