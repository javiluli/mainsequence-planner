export type EditorSelection =
  { kind: 'nodes'; ids: string[] } | { kind: 'part'; stationId: string; placementId: string } | { kind: 'area'; ids: string[] } | null

/** React Flow changes drive the same selection that artwork and clipboard consume. */
export function changeNodeSelection(selection: EditorSelection, changes: readonly { id: string; selected: boolean }[]): EditorSelection {
  const ids = new Set(selection?.kind === 'nodes' ? selection.ids : [])
  for (const change of changes) {
    if (change.selected) ids.add(change.id)
    else ids.delete(change.id)
  }
  if (selection?.kind !== 'nodes' && !ids.size) return selection
  return ids.size ? { kind: 'nodes', ids: [...ids] } : null
}
