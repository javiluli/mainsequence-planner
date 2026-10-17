import { describe, expect, expectTypeOf, it } from 'vitest'
import { outputKeys, validDisabledOutputs } from '@/features/base-designer/lib/output-ports'
import { readSceneDocument } from '@/features/base-designer/lib/scene-document'
import { BELTS, SPLITTERS, TUNNELS, logisticsCapacity, logisticsPorts, tunnelCells } from '@/features/base-designer/model/logistics'
import type { Rotation } from '@/features/base-designer/model/buildings'
import type { Belt } from '@/features/base-designer/model/scene'
import { mixedScene } from './scene-fixture'

describe('Logistics variant contracts', () => {
  it.each([
    ['conveyor', 60, 'MK1'],
    ['conveyor_mk2', 120, 'MK2'],
    ['splitter', 60, 'MK1'],
    ['splitter_mk2', 120, 'MK2'],
    ['underground', 60, 'MK1'],
    ['underground_mk2', 120, 'MK2'],
  ] as const)('keeps the nominal limit and marking of %s', (type, capacity, marking) => {
    expect(logisticsCapacity(type)).toBe(capacity)
    expect({ ...BELTS, ...SPLITTERS, ...TUNNELS }[type].marking).toBe(marking)
  })

  it('keeps omitted legacy belt types as MK1 and derives accepted types from the registry', () => {
    expect(logisticsCapacity(undefined)).toBe(60)
    expectTypeOf<Belt['type']>().toEqualTypeOf<keyof typeof BELTS | undefined>()
  })

  it.each([
    ['underground', 6],
    ['underground_mk2', 8],
  ] as const)('counts buried cells independently of the two mouths for %s', (type, reach) => {
    const entry = { x: -5, y: -7 }
    for (const heading of [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ]) {
      const at = (distance: number) => ({ x: entry.x + heading.x * distance, y: entry.y + heading.y * distance })
      expect(tunnelCells({ type, entry, exit: at(2) })).toEqual([entry, at(1), at(2)])
      const cells = tunnelCells({ type, entry, exit: at(reach + 1) })
      expect(cells).toHaveLength(reach + 2)
      expect(cells?.[0]).toEqual(entry)
      expect(cells?.at(-1)).toEqual(at(reach + 1))
      expect(tunnelCells({ type, entry, exit: at(reach + 2) })).toBeNull()
      expect(tunnelCells({ type, entry, exit: at(1) })).toBeNull()
    }
  })

  it.each(['splitter', 'splitter_mk2'] as const)('keeps local permissions and physical roles for %s in every rotation', (type) => {
    for (const rotation of [0, 90, 180, 270] satisfies Rotation[]) {
      const splitter = { id: 'splitter', type, x: 2, y: 3, rotation, disabledOutputs: ['north'] }
      const keys = outputKeys(splitter),
        ports = logisticsPorts({ splitters: [splitter] })
      expect(keys).toEqual(['east', 'south', 'north'])
      expect(validDisabledOutputs(['west'], keys)).toBe(false)
      expect(ports.filter((port) => port.role === 'input')).toHaveLength(1)
      expect(ports.filter((port) => port.role === 'output')).toHaveLength(3)
      expect(ports.find((port) => port.outputKey === 'north')).toMatchObject({ role: 'output', outputEnabled: false })
      expect(
        ports
          .filter((port) => port.outputEnabled === true)
          .map((port) => port.outputKey)
          .sort(),
      ).toEqual(['east', 'south'])
    }
  })

  it.each(['underground', 'underground_mk2'] as const)('keeps the disabled exit as a physical output for %s', (type) => {
    const tunnel = { id: 'tunnel', type, entry: { x: 2, y: 3 }, exit: { x: 4, y: 3 }, disabledOutputs: ['exit'] }
    expect(outputKeys(tunnel)).toEqual(['exit'])
    expect(validDisabledOutputs(['entry'], outputKeys(tunnel))).toBe(false)
    expect(logisticsPorts({ tunnels: [tunnel] })).toMatchObject([
      { role: 'input', at: tunnel.entry },
      { role: 'output', at: tunnel.exit, outputKey: 'exit', outputEnabled: false },
    ])
  })

  it.each(['__proto__', 'constructor', 'unregistered_mk2', 'unregistered_mk3'])(
    'rejects undeclared variant %s at the saved-data boundary',
    (type) => {
      const scene = mixedScene()
      for (const collection of ['belts', 'splitters', 'tunnels'] as const) {
        const invalid = { ...scene, [collection]: scene[collection].map((piece, i) => (i ? piece : { ...piece, type })) }
        expect(readSceneDocument({ version: 10, scene: invalid })).toBeNull()
      }
    },
  )
})
