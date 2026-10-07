import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { canPasteLayout, type LayoutClipboard } from '../../lib/clipboard/clipboard'
import {
  layoutMovementSource,
  layoutRotationPivot,
  rotateLayout,
  translateLayout,
  type QuarterTurn,
} from '../../lib/layout/layout-transform'
import { type BaseNote, type BaseStation } from '../../lib/layout/placement'
import { CELL_SIZE } from '../../model/catalog'

/**
 * Builds a flow-pixel movement proposal for selected nodes and linked floors.
 * The store sees only one validated transaction at release; cancel never commits a draft.
 */
export function useNodeMovement({
  stations,
  notes,
  selectedIds,
  project,
  onConfirm,
}: {
  stations: BaseStation[]
  notes: BaseNote[]
  selectedIds: readonly string[]
  project: (point: { x: number; y: number }) => { x: number; y: number }
  onConfirm: (stations: BaseStation[], notes: BaseNote[]) => boolean
}) {
  const [draft, setDraft] = useState<LayoutClipboard | null>(null)
  const gesture = useRef<{ draft: LayoutClipboard; pointer: { x: number; y: number }; pivot: { x: number; y: number } } | null>(null)
  const cancel = useCallback(() => {
    gesture.current = null
    setDraft(null)
  }, [])
  // A confirmed layout change invalidates this session; cleanup also cancels on unmount.
  useLayoutEffect(() => cancel, [stations, notes, cancel])
  const publish = (next: LayoutClipboard) => {
    if (!gesture.current) return
    gesture.current.draft = next
    setDraft(next)
  }
  const start = (id: string, point: { x: number; y: number }) => {
    const source = layoutMovementSource(stations, notes, selectedIds.includes(id) ? selectedIds : [id])
    gesture.current = { draft: source, pointer: project(point), pivot: layoutRotationPivot(source) }
    setDraft(source)
  }
  const move = (point: { x: number; y: number }) => {
    const current = gesture.current
    if (!current) return
    const pointer = project(point)
    const dx = Math.round((pointer.x - current.pointer.x) / CELL_SIZE) * CELL_SIZE
    const dy = Math.round((pointer.y - current.pointer.y) / CELL_SIZE) * CELL_SIZE
    if (!dx && !dy) return
    // Advance by the snapped step to retain sub-cell movement. Translate the fixed pivot; never derive it again after a turn.
    current.pointer = { x: current.pointer.x + dx, y: current.pointer.y + dy }
    current.pivot = { x: current.pivot.x + dx, y: current.pivot.y + dy }
    publish(translateLayout(current.draft, { x: dx, y: dy }))
  }
  const rotate = (turn: QuarterTurn) => {
    if (!gesture.current) return false
    publish(rotateLayout(gesture.current.draft, turn, gesture.current.pivot))
    return true
  }
  const compose = (source: LayoutClipboard) => ({
    stations: stations.map((station) => source.stations.find((candidate) => candidate.id === station.id) ?? station),
    notes: notes.map((note) => source.notes.find((candidate) => candidate.id === note.id) ?? note),
  })
  const end = () => {
    const current = gesture.current
    if (!current) return false
    const proposal = compose(current.draft)
    const accepted = onConfirm(proposal.stations, proposal.notes)
    cancel()
    return accepted
  }

  const composed = draft ? compose(draft) : { stations, notes }
  const valid = draft ? canPasteLayout([], { ...draft, ...composed }) : true
  const ids = useMemo(() => new Set(draft ? [...draft.stations, ...draft.notes].map((entry) => entry.id) : []), [draft])
  return {
    ...composed,
    draft,
    active: draft !== null,
    ids,
    valid,
    start,
    move,
    rotate,
    end,
    cancel,
  }
}
