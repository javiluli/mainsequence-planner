// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DroneCargoDialog } from '@/features/base-designer/ui/drone-cargo-dialog'
import type { DroneStation } from '@/features/base-designer/model/scene'

const station: DroneStation = { id: 'drone', type: 'drone', x: 0, y: 0, rotation: 0, cargo: ['T_CobaltOre', null] }

beforeEach(() => {
  // Tabs observe their indicator; jsdom has no layout observer.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Mirrors the editor's slot-dependent callback while retaining real HeroUI collection caching. */
function CargoEditor({ onChoose }: { onChoose: (slot: 0 | 1, itemId: string | null) => void }) {
  const [slot, setSlot] = useState<0 | 1>(0)
  return <DroneCargoDialog station={station} slot={slot} onSlotChange={setSlot} onChoose={(id) => onChoose(slot, id)} onClose={() => {}} />
}

describe('Drone cargo dialog (D01)', () => {
  it('uses the current slot after switching tabs without rebuilding the catalog items', async () => {
    const choose = vi.fn<(slot: 0 | 1, itemId: string | null) => void>()
    render(
      <HeroUIProvider disableAnimation>
        <CargoEditor onChoose={choose} />
      </HeroUIProvider>,
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Cargo 2' }))
    const secondCargo = await screen.findByRole('listbox', { name: 'Products for cargo 2' })
    fireEvent.click(within(secondCargo).getByRole('option', { name: 'Titanium Ore' }))
    expect(choose).toHaveBeenCalledWith(1, 'T_TitaniumOre')
    expect(choose).not.toHaveBeenCalledWith(0, expect.anything())
    choose.mockClear()

    fireEvent.click(screen.getByRole('tab', { name: 'Cargo 1' }))
    const firstCargo = await screen.findByRole('listbox', { name: 'Products for cargo 1' })
    fireEvent.click(within(firstCargo).getByRole('option', { name: 'Cobalt Ore' }))
    expect(choose).toHaveBeenCalledWith(0, 'T_CobaltOre')
    expect(choose).not.toHaveBeenCalledWith(1, expect.anything())
  })
})
