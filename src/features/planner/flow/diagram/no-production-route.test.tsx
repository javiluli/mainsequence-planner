/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProductionPlanContext } from '@/features/planner/hooks/use-production-plan'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import { buildings, items, producerBuildingsByItemId } from '@/shared/data'
import { NoProductionRoute } from './no-production-route'

afterEach(cleanup)

describe('NoProductionRoute', () => {
  it('shows the real Xenoeukarya recipe and names the missing Biomass source', () => {
    const plan = buildProductionPlan({
      buildings,
      producerBuildingsByItemId,
      targetId: 'T_Xenoeukarya',
      targetIpm: 30,
      isRawTarget: false,
      rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
      supplyCountByItem: {},
    })

    render(
      <ProductionPlanContext.Provider value={plan}>
        <NoProductionRoute />
      </ProductionPlanContext.Provider>,
    )

    expect(screen.getByRole('heading', { name: 'Plan incomplete for Xenoeukarya' })).toBeInTheDocument()
    expect(screen.getByText('Growth Chamber')).toBeInTheDocument()
    expect(screen.getByText(/30\/min net after recycling/)).toBeInTheDocument()
    expect(screen.getByText(/Biomass has no standalone production recipe/)).toBeInTheDocument()
    expect(screen.getByText(/It is a byproduct of Growth Chamber/)).toBeInTheDocument()
  })
})
