import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createLayoutActions } from './base-designer/layout-actions'
import { createPlacementActions } from './base-designer/placement-actions'
import { createProductActions } from './base-designer/product-actions'
import { BASE_STORAGE_KEY, BASE_STORAGE_VERSION, createBaseStorage } from './base-designer/persistence'
import type { BaseDesignerState } from './base-designer/types'

/**
 * Owns confirmed layout and session undo history. Only stations/notes cross the storage boundary;
 * selection, clipboard, previews, viewport and React Flow measurements stay with their UI owners.
 */
export function createBaseDesignerStore(getStorage?: Parameters<typeof createBaseStorage>[1]) {
  const storage = createBaseStorage((storageIssue) => {
    if (store.getState().storageIssue !== storageIssue) store.setState({ storageIssue })
  }, getStorage)
  const store = create<BaseDesignerState>()(
    persist(
      (set, get) => {
        // UUIDs remain unique after reload, undo or paste without persisting a second counter/source of truth.
        const context = { set, get, makeId: () => `base-part-${crypto.randomUUID()}` }
        return {
          stations: [],
          notes: [],
          past: [],
          future: [],
          storageIssue: null,
          ...createLayoutActions(context),
          ...createProductActions(context),
          ...createPlacementActions(context),
        }
      },
      {
        name: BASE_STORAGE_KEY,
        version: BASE_STORAGE_VERSION,
        storage,
        partialize: ({ stations, notes }) => ({ stations, notes }),
        // Storage has already decoded the document. Never hydrate actions or old undo snapshots.
        merge: (saved, current) => ({ ...current, ...(saved ?? {}), past: [], future: [] }),
      },
    ),
  )
  return store
}

export const useBaseDesignerStore = createBaseDesignerStore()
