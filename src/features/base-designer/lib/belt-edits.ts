import type { Belt, Point, Scene } from '../model/scene'
import { beltCells, beltConnections, containsBeltCell, samePoint } from './belts'
import { canDrawBelt } from './placement'
import { floorCellLimit } from './stations'

/** An unconfirmed route may inherit an existing continuation's ID before any new identity is allocated. */
type BeltProposal = Omit<Belt, 'id'> & { id?: string }

/** Remove newly occupied splitter cells; keep the original upstream ID, bends, tier and one-cell direction. */
export function cutBeltsAt(scene: Scene, splitters: readonly Point[], originalBelts = scene.belts): readonly (Belt | Omit<Belt, 'id'>)[] {
  if (!splitters.length) return scene.belts
  const cuts = new Set(splitters.map((point) => `${point.x},${point.y}`))
  const housings = new Set([...cuts, ...(scene.splitters ?? []).map((point) => `${point.x},${point.y}`)])
  const limit = floorCellLimit(scene.stations)
  const unchanged = new Set(originalBelts)
  return scene.belts.flatMap((belt) => {
    // An intact pasted/moved legacy group retains its internal routes and complete selection.
    if (!unchanged.has(belt)) return [belt]
    if (!splitters.some((point) => containsBeltCell(belt.points, point))) return [belt]
    const cells = beltCells(belt.points, limit)
    if (!cells) return [belt]
    if (!cells.some((point, i) => i > 0 && i < cells.length - 1 && cuts.has(`${point.x},${point.y}`))) return [belt]
    // A touched legacy lane may contain neighboring inline splitters too; no fragment may end inside their housings.
    const indices = cells.flatMap((point, i) => (i > 0 && i < cells.length - 1 && housings.has(`${point.x},${point.y}`) ? [i] : []))
    const fragments: (Belt | Omit<Belt, 'id'>)[] = []
    let start = 0
    for (const end of [...indices, cells.length]) {
      const fragment = cells.slice(start, end)
      if (fragment.length) {
        const points = fragment.filter((_, i) => {
          const before = fragment[i - 1],
            after = fragment[i + 1]
          return !before || !after || (before.x !== after.x && before.y !== after.y)
        })
        const next = cells[start + 1]
        const previous = cells[start - 1]
        fragments.push({
          ...(fragments.length ? {} : { id: belt.id }),
          ...(belt.type && { type: belt.type }),
          points,
          ...(points.length === 1 && {
            heading: next
              ? { x: next.x - points[0].x, y: next.y - points[0].y }
              : { x: points[0].x - previous.x, y: points[0].y - previous.y },
          }),
        })
      }
      start = end + 1
    }
    return fragments
  })
}

/** Coalesce only unambiguous end-to-start continuations of the same tier; T branches and fixed I/O remain boundaries. */
export function joinBeltContinuations(scene: Scene, proposal: BeltProposal) {
  let belt = proposal
  const absorbed = new Set<string>()
  for (;;) {
    let joined = false
    for (const peer of scene.belts) {
      if (peer.id === proposal.id || absorbed.has(peer.id) || (peer.type ?? 'conveyor') !== (belt.type ?? 'conveyor')) continue
      const prefix = samePoint(peer.points.at(-1)!, belt.points[0])
      const suffix = samePoint(belt.points.at(-1)!, peer.points[0])
      if (!prefix && !suffix) continue
      const cell = prefix ? belt.points[0] : peer.points[0]
      if (
        scene.belts.some(
          (other) => other.id !== peer.id && other.id !== proposal.id && !absorbed.has(other.id) && containsBeltCell(other.points, cell),
        )
      )
        continue
      const connections = beltConnections(scene, peer)
      if (
        prefix
          ? connections.input || connections.logisticsInput
          : connections.output || connections.logisticsOutput || connections.droneOutput
      )
        continue
      const points = prefix ? [...peer.points, ...belt.points.slice(1)] : [...belt.points, ...peer.points.slice(1)]
      if (points.length < 2) continue
      if (peer.heading) {
        const direction = prefix
          ? { x: Math.sign(points[1].x - points[0].x), y: Math.sign(points[1].y - points[0].y) }
          : { x: Math.sign(points.at(-1)!.x - points.at(-2)!.x), y: Math.sign(points.at(-1)!.y - points.at(-2)!.y) }
        if (!samePoint(direction, peer.heading)) continue
      }
      const remaining = {
        ...scene,
        belts: scene.belts.filter((other) => other.id !== peer.id && other.id !== proposal.id && !absorbed.has(other.id)),
      }
      if (!canDrawBelt(remaining, { points, type: belt.type })) continue
      absorbed.add(peer.id)
      belt = { id: belt.id ?? peer.id, points, ...(belt.type && { type: belt.type }) }
      joined = true
      break
    }
    if (!joined) return { belt, absorbed }
  }
}
