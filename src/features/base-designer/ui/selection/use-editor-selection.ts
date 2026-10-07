import { useCallback, useMemo, useState } from 'react'
import { changeNodeSelection, type EditorSelection } from '../../model/editor-selection'

const emptySelectionIds: readonly string[] = []

/**
 * Own the explicit selection used by node highlights, area artwork and clipboard commands.
 * activeStationId is editing context, not selection. Sets/ID lists are derived here rather than synchronized
 * with React Flow through effects; its select changes are applied directly to the same model.
 */
export function useEditorSelection() {
  const [selection, setSelection] = useState<EditorSelection>(null)
  const selectedPart = selection?.kind === 'part' ? selection : null
  // Empty IDs keep occupancy/artwork inputs stable when only node highlights or editing context change.
  const selectedAreaIds = selection?.kind === 'area' ? selection.ids : emptySelectionIds
  const selectedNodeIds = selection?.kind === 'nodes' ? selection.ids : emptySelectionIds
  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds])
  const selectedAreaSet = useMemo(() => new Set(selectedAreaIds), [selectedAreaIds])
  const selectNode = useCallback((id: string, additive: boolean) => {
    setSelection((current) => {
      const ids = new Set(additive && current?.kind === 'nodes' ? current.ids : [])
      if (ids.has(id)) ids.delete(id)
      else ids.add(id)
      return ids.size ? { kind: 'nodes', ids: [...ids] } : null
    })
  }, [])
  const selectArea = useCallback((ids: string[]) => setSelection(ids.length ? { kind: 'area', ids } : null), [])
  const applyNodeChanges = useCallback((changes: readonly { id: string; selected: boolean }[]) => {
    setSelection((current) => changeNodeSelection(current, changes))
  }, [])

  return {
    selection,
    setSelection,
    selectedPart,
    selectedAreaIds,
    selectedNodeIds,
    selectedNodeSet,
    selectedAreaSet,
    selectNode,
    selectArea,
    applyNodeChanges,
  }
}
