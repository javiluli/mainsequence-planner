/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProductionCell } from './items-table-cells'

afterEach(cleanup)

describe('ProductionCell', () => {
  it('describes raw items as external inputs even when an optional synthesis recipe exists', () => {
    render(<ProductionCell itemType="raw" producerName="Enrichment Chamber" />)

    expect(screen.getByText('External supply')).toBeInTheDocument()
    expect(screen.getByText('Optional synthesis: Enrichment Chamber')).toBeInTheDocument()
  })

  it('shows the production machine for processed items', () => {
    render(<ProductionCell itemType="processed" producerName="Refinery" />)

    expect(screen.getByText('Refinery')).toBeInTheDocument()
    expect(screen.queryByText('External supply')).not.toBeInTheDocument()
  })

  it('identifies a coproduct without implying a standalone production route', () => {
    render(<ProductionCell itemType="component" producerName={undefined} byproductProducerName="Growth Chamber" />)

    expect(screen.getByText('Byproduct · Growth Chamber')).toBeInTheDocument()
  })
})
