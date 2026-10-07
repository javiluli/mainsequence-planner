import { useCallback, useMemo, useState, type RefObject } from 'react'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import { createClipboardPayload, type EditorClipboard } from '../../lib/clipboard/clipboard'
import type { BaseNote, BaseStation } from '../../lib/layout/placement'
import { worldPlacements, type WorldPlacement } from '../../lib/layout/world-layout'
import { selectionRemovalCheck } from '../../lib/layout/removal'
import type { EditorSelection } from '../../model/editor-selection'

interface PendingStationRemoval {
  stationId: string
  cutting: boolean
}

interface SelectionCommandOptions {
  selection: EditorSelection
  setSelection: (selection: EditorSelection) => void
  stations: readonly BaseStation[]
  notes: readonly BaseNote[]
  renderStations: readonly BaseStation[]
  worldPieces: readonly WorldPlacement[]
  canvasRef: RefObject<HTMLDivElement | null>
  lastCanvasPointer: RefObject<{ x: number; y: number } | null>
  onPrepare: () => void
  onPaste: (clipboard: EditorClipboard, point: { x: number; y: number }) => void
  onStationRemoved: (stationId: string) => void
  onPartsRemoved: () => void
}

/**
 * Execute selection commands from toolbar or keyboard using one clipboard and one pending confirmation.
 * Cancel competing gestures before acting. Cut/confirmation read the committed layout again and publish
 * their snapshot only after accepted removal; a canceled/rejected dialog must preserve the previous clipboard.
 * Paste hands a client-pixel origin to the independent repeatable placement session, never storing another ghost.
 */
export function useSelectionCommands({
  selection,
  setSelection,
  stations,
  notes,
  renderStations,
  worldPieces,
  canvasRef,
  lastCanvasPointer,
  onPrepare,
  onPaste,
  onStationRemoved,
  onPartsRemoved,
}: SelectionCommandOptions) {
  const removeStation = useBaseDesignerStore((state) => state.removeStation)
  const removeNote = useBaseDesignerStore((state) => state.removeNote)
  const removePlacements = useBaseDesignerStore((state) => state.removePlacements)
  const [clipboard, setClipboard] = useState<EditorClipboard | null>(null)
  const pasteDescription =
    clipboard?.kind === 'layout' && (clipboard.source.skippedRoutes || clipboard.source.skippedParts)
      ? `Paste · Ctrl+V. Copy excludes ${clipboard.source.skippedRoutes} complete route(s) and ${clipboard.source.skippedParts} part(s) requiring unselected stations.`
      : 'Paste · Ctrl+V'
  const [pendingRemoval, setPendingRemoval] = useState<PendingStationRemoval | null>(null)
  const deleteOpen = pendingRemoval !== null
  const removalCheck = useMemo(() => selectionRemovalCheck(selection, stations, notes), [selection, stations, notes])

  const copySelection = useCallback(() => {
    onPrepare()
    const payload = createClipboardPayload({ selection, stations, notes, worldPieces })
    if (payload) setClipboard(payload)
  }, [selection, stations, notes, worldPieces, onPrepare])

  const pasteSelection = useCallback(() => {
    if (!clipboard) return
    onPrepare()
    setSelection(null)
    const bounds = canvasRef.current?.getBoundingClientRect()
    const point = lastCanvasPointer.current ?? {
      x: bounds ? bounds.left + bounds.width / 2 : 0,
      y: bounds ? bounds.top + bounds.height / 2 : 0,
    }
    onPaste(clipboard, point)
    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }))
  }, [clipboard, onPaste, onPrepare, canvasRef, lastCanvasPointer, setSelection])

  const removeSelection = useCallback(
    (cutting: boolean) => {
      onPrepare()
      const state = useBaseDesignerStore.getState()
      const check = selectionRemovalCheck(selection, state.stations, state.notes)
      if (!check.allowed) return
      const target = check.target
      if (target.kind === 'station' && target.needsConfirmation) {
        setPendingRemoval({ stationId: target.id, cutting })
        return
      }
      // Snapshot the confirmed layout before deletion, but publish Cut only when removal succeeds (including modal confirmation).
      const cutPayload = cutting
        ? createClipboardPayload({
            selection,
            stations: state.stations,
            notes: state.notes,
            worldPieces: state.stations === renderStations ? worldPieces : worldPlacements(state.stations),
          })
        : null
      if (cutting && !cutPayload) return
      if (target.kind === 'station') {
        if (!removeStation(target.id)) {
          setPendingRemoval({ stationId: target.id, cutting })
          return
        }
        onStationRemoved(target.id)
      } else if (target.kind === 'note') {
        removeNote(target.id)
      } else {
        removePlacements(target.ids)
        onPartsRemoved()
      }
      if (cutPayload) setClipboard(cutPayload)
      setSelection(null)
    },
    [
      selection,
      renderStations,
      worldPieces,
      onPrepare,
      removeStation,
      removeNote,
      removePlacements,
      onStationRemoved,
      onPartsRemoved,
      setSelection,
    ],
  )
  const deleteSelection = useCallback(() => removeSelection(false), [removeSelection])
  const cutSelection = useCallback(() => removeSelection(true), [removeSelection])
  const confirmStationRemoval = useCallback(
    (id: string) => {
      if (!pendingRemoval || pendingRemoval.stationId !== id) return false
      const state = useBaseDesignerStore.getState()
      // A confirmed Cut copies the contents being removed now, not a second payload stored when the dialog opened.
      const cutPayload = pendingRemoval.cutting
        ? createClipboardPayload({
            selection: { kind: 'nodes', ids: [id] },
            stations: state.stations,
            notes: state.notes,
            worldPieces: state.stations === renderStations ? worldPieces : worldPlacements(state.stations),
          })
        : null
      if ((pendingRemoval.cutting && !cutPayload) || !removeStation(id)) return false
      if (cutPayload) setClipboard(cutPayload)
      onStationRemoved(id)
      setSelection(null)
      return true
    },
    [pendingRemoval, removeStation, onStationRemoved, renderStations, worldPieces, setSelection],
  )
  const closeStationRemoval = useCallback(() => setPendingRemoval(null), [])

  return {
    canPaste: clipboard !== null,
    pasteDescription,
    pendingRemoval,
    deleteOpen,
    removalCheck,
    copySelection,
    pasteSelection,
    deleteSelection,
    cutSelection,
    confirmStationRemoval,
    closeStationRemoval,
  }
}
