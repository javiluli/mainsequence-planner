import { isUndergroundType, type RouteTool } from '../../model/catalog'
import { oppositeDirection } from '../connections/ports'
import type { RouteCell } from './route'

/** Buried length excludes both surface mouths; null means the tool is not a tunnel. */
export function maxBuriedCells(type: RouteTool): number | null {
  if (type === 'underground') return 6
  if (type === 'underground_mk2') return 8
  return null
}

/** A tunnel is a single straight, directed path with surface-only entrance and exit. */
export function isUndergroundPath(type: RouteTool, cells: readonly RouteCell[], complete: boolean): boolean {
  if (!isUndergroundType(type)) return false
  const maximum = maxBuriedCells(type)
  if (maximum === null || cells.length > maximum + 2 || (complete && cells.length < 3) || cells.length === 0) return false
  if (cells.length === 1) return !complete
  const first = cells[0]
  const last = cells[cells.length - 1]
  const horizontal = first.y === last.y
  const vertical = first.x === last.x
  if (horizontal === vertical) return false
  const direction = horizontal ? (last.x > first.x ? 'east' : 'west') : last.y > first.y ? 'south' : 'north'
  const [dx, dy] = direction === 'east' ? [1, 0] : direction === 'west' ? [-1, 0] : direction === 'south' ? [0, 1] : [0, -1]
  return cells.every(
    (cell, index) =>
      cell.x === first.x + dx * index &&
      cell.y === first.y + dy * index &&
      cell.direction === direction &&
      cell.incoming === oppositeDirection(direction),
  )
}
