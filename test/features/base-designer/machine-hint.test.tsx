// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { beltNetwork } from '@/features/base-designer/lib/belt-network'
import { analyzeProduction } from '@/features/base-designer/lib/production-analysis'
import type { Scene } from '@/features/base-designer/model/scene'
import { MachineHint } from '@/features/base-designer/ui/machine-hint'
import type { HoveredPort } from '@/features/base-designer/ui/port-hint'
import { productionAmount } from '@/features/base-designer/ui/production-amount'
import { containerScene } from './scene-fixture'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('keeps rounded rates, missing estimates and tiny positive quantities distinct', () => {
  expect(productionAmount(60)).toBe(60)
  expect(productionAmount(12.36)).toBe(12.4)
  expect(productionAmount(0)).toBe(0)
  expect(productionAmount(0.03)).toBe('<0.1')
  expect(productionAmount(null)).toBe('—')
  expect(productionAmount(Number.NaN)).toBe('—')
})

it('shows every received BOX item and its lane rate, then refreshes to the empty state', () => {
  const scene = containerScene(),
    hover: HoveredPort = { owner: { kind: 'building', id: 'box' }, key: 'body', x: 100, y: 100 },
    view = render(<MachineHint scene={scene} analysis={analyzeProduction(scene, beltNetwork(scene))} hover={hover} />),
    hint = screen.getByRole('tooltip')
  expect(hint.textContent).toContain('Receiving items')
  expect(hint.textContent).toContain('Cobalt Ore60/min')
  expect(hint.textContent).toContain('Titanium Ore120/min')
  expect(hint.textContent).not.toContain('Supplied / Needed')
  expect(hint.textContent).not.toContain('recipe')
  const empty = { ...scene, belts: [] }
  view.rerender(<MachineHint scene={empty} analysis={analyzeProduction(empty, beltNetwork(empty))} hover={hover} />)
  expect(screen.getByRole('tooltip')).toBe(hint)
  expect(hint.textContent).toContain('No incoming items')
  expect(hint.textContent).not.toContain('Cobalt Ore')
  expect(hint.textContent).not.toContain('/min')
})

it('shows an incoming BOX item with an undetermined rate when its producer lacks ingredients', () => {
  const scene: Scene = {
    stations: [{ id: 'floor', x: 0, y: 0 }],
    buildings: [
      { id: 'producer', stationId: 'floor', type: 'refinery', x: 1, y: 3, rotation: 0, recipeId: 'cobalt_plates' },
      { id: 'box', stationId: 'floor', type: 'container', x: 9, y: 3, rotation: 0 },
    ],
    belts: [
      {
        id: 'lane',
        points: [
          { x: 4, y: 4 },
          { x: 8, y: 4 },
        ],
      },
    ],
  }
  render(
    <MachineHint
      scene={scene}
      analysis={analyzeProduction(scene, beltNetwork(scene))}
      hover={{ owner: { kind: 'building', id: 'box' }, key: 'body', x: 100, y: 100 }}
    />,
  )
  expect(screen.getByRole('tooltip').textContent).toContain('Cobalt Plates—/min')
  expect(screen.getByRole('tooltip').textContent).toContain('Supply is limited upstream.')
  expect(screen.getByRole('tooltip').textContent).toContain('Not determined')
})

it('retains machine content while pointer coordinates change without rendering or remeasuring', () => {
  const scene: Scene = {
    stations: [{ id: 'floor', x: 0, y: 0 }],
    buildings: [{ id: 'machine', stationId: 'floor', type: 'refinery', x: 1, y: 1, rotation: 0, recipeId: 'cobalt_plates' }],
    belts: [],
  }
  const hover: HoveredPort = { owner: { kind: 'building', id: 'machine' }, key: 'body', x: 70, y: 100 }
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(288),
    height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160),
    onRender = vi.fn(),
    owner = document.createElement('div')
  document.body.append(owner)
  const view = render(
    <Profiler id="machine-hint" onRender={onRender}>
      <MachineHint scene={scene} analysis={analyzeProduction(scene, beltNetwork(scene))} hover={hover} />
    </Profiler>,
    { container: owner },
  )
  const hint = screen.getByRole('tooltip')
  expect(hint.textContent).toContain('Cobalt Plates')
  expect(hint.textContent).toContain('Cobalt Ore')
  expect(hint.textContent).toContain('0/min')
  expect(hint.textContent).toContain('0 / 20')
  // jsdom protects measured bounds/fallback; actual pixel clamping requires a real browser.
  expect(hint.style.left).toBe('clamp(8px, var(--machine-pointer-x, 86px), calc(100% - 296px))')
  expect(hint.style.top).toBe('clamp(8px, var(--machine-pointer-y, 116px), calc(100% - 168px))')
  const renders = onRender.mock.calls.length,
    measurements = [width.mock.calls.length, height.mock.calls.length],
    content = hint.textContent
  owner.style.setProperty('--machine-pointer-x', '416px')
  owner.style.setProperty('--machine-pointer-y', '316px')
  owner.style.setProperty('--machine-pointer-x', '1016px')
  owner.style.setProperty('--machine-pointer-y', '816px')
  expect(screen.getByRole('tooltip')).toBe(hint)
  expect(hint.textContent).toBe(content)
  expect(onRender).toHaveBeenCalledTimes(renders)
  expect([width.mock.calls.length, height.mock.calls.length]).toEqual(measurements)

  // A confirmed recipe change can shrink the content and must refresh its bounds on the same node.
  const changed: Scene = { ...scene, buildings: scene.buildings.map((building) => ({ ...building, recipeId: undefined })) }
  height.mockReturnValue(80)
  view.rerender(
    <Profiler id="machine-hint" onRender={onRender}>
      <MachineHint scene={changed} analysis={analyzeProduction(changed, beltNetwork(changed))} hover={hover} />
    </Profiler>,
  )
  expect(screen.getByRole('tooltip')).toBe(hint)
  expect(hint.textContent).not.toContain('Cobalt Plates')
  expect(hint.textContent).not.toContain('Cobalt Ore')
  expect(hint.style.top).toBe('clamp(8px, var(--machine-pointer-y, 116px), calc(100% - 88px))')
  expect(height.mock.calls.length).toBeGreaterThan(measurements[1])
})
