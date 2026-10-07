import type { PersistStorage } from 'zustand/middleware'
import { decodeBaseLayout, type BaseLayoutDocument } from '@/features/base-designer/lib/layout/layout-document'

export const BASE_STORAGE_KEY = 'mainsequence-base-layout'
export const BASE_STORAGE_VERSION = 1
export type BaseStorageIssue = 'unavailable' | 'invalid' | 'newer' | 'conflict' | null

/** Small synchronous browser boundary; failures never abort a confirmed editor transaction. */
export function createBaseStorage(
  report: (issue: BaseStorageIssue) => void,
  getStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = () =>
    typeof window === 'undefined' ? undefined : window.localStorage,
): PersistStorage<BaseLayoutDocument> {
  let blocked = false
  let lastSaved: BaseLayoutDocument | undefined
  let lastStored: string | null = null
  // Defer notifications until persist has finished creating/hydrating the store. They are never saved.
  const notify = (issue: BaseStorageIssue) => queueMicrotask(() => report(issue))
  return {
    getItem: (name) => {
      let raw: string | null | undefined
      try {
        raw = getStorage()?.getItem(name)
      } catch {
        notify('unavailable')
        return null
      }
      lastStored = raw ?? null
      if (!raw) return null
      try {
        const envelope: unknown = JSON.parse(raw)
        if (typeof envelope !== 'object' || envelope === null || !('version' in envelope) || !('state' in envelope))
          throw new Error('Invalid envelope')
        if (envelope.version !== BASE_STORAGE_VERSION) {
          blocked = true
          notify(typeof envelope.version === 'number' && envelope.version > BASE_STORAGE_VERSION ? 'newer' : 'invalid')
          return null
        }
        const state = decodeBaseLayout(envelope.state)
        if (!state) throw new Error('Invalid layout')
        lastSaved = state
        return { state, version: BASE_STORAGE_VERSION }
      } catch {
        // Keep unreadable data untouched; editing an empty fallback must not erase a recoverable save.
        blocked = true
        notify('invalid')
        return null
      }
    },
    setItem: (name, value) => {
      if (blocked || (lastSaved?.stations === value.state.stations && lastSaved?.notes === value.state.notes)) return
      try {
        const storage = getStorage()
        if (!storage) return
        // Reject a stale tab's save instead of overwriting newer confirmed work.
        if (storage.getItem(name) !== lastStored) {
          blocked = true
          notify('conflict')
          return
        }
        const serialized = JSON.stringify(value)
        storage.setItem(name, serialized)
        lastStored = serialized
        lastSaved = value.state
        notify(null)
      } catch {
        notify('unavailable')
      }
    },
    removeItem: (name) => {
      try {
        getStorage()?.removeItem(name)
      } catch {
        notify('unavailable')
      }
    },
  }
}
