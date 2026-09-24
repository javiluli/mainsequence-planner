/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetImage } from './asset-image'
import { getIconSource } from './icon-source'

afterEach(cleanup)

describe('Component <AssetImage />', () => {
  it.each([
    ['items', 'T_HullPlate'],
    ['buildings', 'T_Assembler'],
  ] as const)('builds a public URL for %s icons', (kind, id) => {
    render(<AssetImage kind={kind} id={id} width={48} />)

    expect(screen.getByRole('img', { name: id.replaceAll('_', ' ') })).toHaveAttribute('src', `/assets/icons/${kind}/${id}.webp`)
  })

  it('resolves artwork separately from distinct gameplay item IDs', () => {
    expect(getIconSource('items', 'T_ContainmentCoil')).toBe('/assets/icons/items/T_ContainmentCoil1.webp')
    expect(getIconSource('items', 'backpack_mk2')).toBe('/assets/icons/items/T_Backpack_1.webp')
    expect(getIconSource('items', 'backpack_mk3')).toBe('/assets/icons/items/T_Backpack_1.webp')
    expect(getIconSource('items', 'repair_kit_hull')).toBe('/assets/icons/items/T_RepairKit.webp')
    expect(getIconSource('buildings', 'refinery')).toBe('/assets/icons/buildings/T_Refinery.webp')
    expect(getIconSource('buildings', 'growth_chamber')).toBe('/assets/icons/buildings/T_GrowthChamber1.webp')
    expect(getIconSource('buildings', 'advanced_assembler')).toBe('/assets/icons/buildings/T_AdvancedAssembler1.webp')
    expect(getIconSource('buildings', 'armoury')).toBe('/assets/icons/buildings/T_Armoury.webp')
    expect(getIconSource('buildings', 'relic_synthesizer')).toBe('/assets/icons/buildings/T_RelicSynthesizer.webp')
    expect(getIconSource('buildings', 'supercomputer')).toBe('/assets/icons/buildings/T_Supercomputer.webp')
  })

  it('reserves its dimensions and uses native lazy loading by default', () => {
    render(<AssetImage kind="items" id="T_HullPlate" width={56} />)

    const image = screen.getByRole('img', { name: 'T HullPlate' })
    const container = image.parentElement

    expect(image).toHaveAttribute('width', '56')
    expect(image).toHaveAttribute('height', '56')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('decoding', 'async')
    expect(container).toHaveStyle({ width: '56px', height: '56px' })
  })

  it('hides alternative text visually behind a skeleton until the image loads', () => {
    render(<AssetImage kind="items" id="T_HullPlate" width={48} />)
    const image = screen.getByRole('img', { name: 'T HullPlate' })
    const imageContainer = image.parentElement

    expect(imageContainer).toHaveAttribute('data-load-state', 'loading')
    expect(screen.getByTestId('asset-image-placeholder')).toBeInTheDocument()
    expect(image).toHaveStyle({ opacity: '0' })

    fireEvent.load(image)

    expect(imageContainer).toHaveAttribute('data-load-state', 'loaded')
    expect(screen.queryByTestId('asset-image-placeholder')).not.toBeInTheDocument()
    expect(image).toHaveStyle({ opacity: '1' })
  })

  it('shows a neutral fallback without exposing broken-image text', () => {
    render(<AssetImage kind="items" id="missing" width={48} alt="Missing icon" />)
    const image = screen.getByRole('img', { name: 'Missing icon' })

    fireEvent.error(image)

    expect(image.parentElement).toHaveAttribute('data-load-state', 'error')
    expect(screen.queryByTestId('asset-image-placeholder')).not.toBeInTheDocument()
    expect(screen.getByTestId('asset-image-fallback')).toBeInTheDocument()
    expect(image).toHaveStyle({ opacity: '0' })
  })

  it('supports a custom accessible name and eager loading', () => {
    render(<AssetImage kind="items" id="T_HullPlate" width={32} alt="Hull Plate" loading="eager" fetchPriority="high" />)

    expect(screen.getByRole('img', { name: 'Hull Plate' })).toHaveAttribute('loading', 'eager')
    expect(screen.getByRole('img', { name: 'Hull Plate' })).toHaveAttribute('fetchpriority', 'high')
  })
})
