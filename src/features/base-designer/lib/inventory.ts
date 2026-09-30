import { CELL_SIZE, PLACEABLES, type Direction } from '../model/catalog'
import type { BasePlacement, BaseStation } from './placement'

interface InventoryEntryBase {
  key: string
  stationId: string
  placement: BasePlacement
  stationIds: string[]
  directions: Direction[]
  bounds: { x: number; y: number; width: number; height: number }
}

export type LayoutInventoryEntry =
  (InventoryEntryBase & { kind: 'part' }) | (InventoryEntryBase & { kind: 'route'; routeId: string; cellCount: number })

export function inventoryEntryKey(placement: BasePlacement): string {
  return placement.routeId ? `route:${placement.routeId}` : `part:${placement.id}`
}

/** Routes spanning multiple modules remain one selectable entry; source placements are never changed. */
export function buildLayoutInventory(stations: readonly BaseStation[]): LayoutInventoryEntry[] {
  const entries = new Map<string, LayoutInventoryEntry>()
  for (const station of stations) {
    for (const placement of station.placements) {
      const key = inventoryEntryKey(placement)
      const footprint = PLACEABLES[placement.type]
      const x = station.position.x + placement.x * CELL_SIZE
      const y = station.position.y + placement.y * CELL_SIZE
      const width = footprint.width * CELL_SIZE
      const height = footprint.height * CELL_SIZE
      const existing = entries.get(key)
      if (existing?.kind === 'route') {
        existing.cellCount++
        if (!existing.stationIds.includes(station.id)) existing.stationIds.push(station.id)
        if (!existing.directions.includes(placement.direction)) existing.directions.push(placement.direction)
        const right = Math.max(existing.bounds.x + existing.bounds.width, x + width)
        const bottom = Math.max(existing.bounds.y + existing.bounds.height, y + height)
        existing.bounds.x = Math.min(existing.bounds.x, x)
        existing.bounds.y = Math.min(existing.bounds.y, y)
        existing.bounds.width = right - existing.bounds.x
        existing.bounds.height = bottom - existing.bounds.y
        continue
      }
      const common = {
        key,
        stationId: station.id,
        placement,
        stationIds: [station.id],
        directions: [placement.direction],
        bounds: { x, y, width, height },
      }
      entries.set(
        key,
        placement.routeId ? { ...common, kind: 'route', routeId: placement.routeId, cellCount: 1 } : { ...common, kind: 'part' },
      )
    }
  }
  return [...entries.values()]
}
