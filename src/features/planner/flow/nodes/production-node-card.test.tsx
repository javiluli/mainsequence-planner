/* @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductionNodeCard } from './production-node-card'

describe('ProductionNodeCard', () => {
  it('shows required and nominal rates without suggesting the machine can be throttled', () => {
    render(
      <ProductionNodeCard
        data={{
          buildingId: 'CRAFT_Refinery',
          buildingName: 'Refinery',
          buildingPower: 4.5,
          buildingLoad: 1.5,
          buildingCount: 2,
          itemId: 'T_NickelPlates',
          itemName: 'Nickel Plates',
          baseIpm: 20,
          targetIpm: 30,
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Refinery' })).toBeTruthy()
    expect(screen.getByText('Nickel Plates')).toBeTruthy()
    expect(screen.getByText('30.0')).toBeTruthy()
    expect(screen.getByText('Nominal 20.0/min')).toBeTruthy()
    expect(screen.queryByRole('meter')).toBeNull()
    expect(screen.queryByText(/used/i)).toBeNull()
    expect(screen.queryByText('Output')).toBeNull()
  })
})
