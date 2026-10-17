import { readSceneDocument, writeSceneDocument } from '@/features/base-designer/lib/scene-document'
import type { Scene } from '@/features/base-designer/model/scene'

/** Separate from mainsequence-base-layout; legacy layouts and notes are never touched. */
export const SCENE_STORAGE_KEY = 'mainsequence-base-scene'
/** Minimal browser-storage boundary; injected stores can exercise failures without touching a player's document. */
export type SceneStorage = Pick<Storage, 'getItem' | 'setItem'>
/** Session-only failures; unreadable or externally changed documents must not be replaced. */
export type StorageIssue = 'unavailable' | 'unreadable' | 'write-failed' | 'conflict'

/** Read once, then save atomic scenes with a check against accidental overwrites from another tab. */
export function createScenePersistence(getStorage: () => SceneStorage) {
  let scene: Scene = { stations: [], buildings: [], belts: [] }
  let issue: StorageIssue | null = null
  let storage: SceneStorage | undefined
  let expected: string | null = null
  try {
    storage = getStorage()
    expected = storage.getItem(SCENE_STORAGE_KEY)
  } catch {
    issue = 'unavailable'
  }
  if (!issue && expected !== null) {
    try {
      const restored = readSceneDocument(JSON.parse(expected))
      if (!restored) issue = 'unreadable'
      else scene = restored
    } catch {
      issue = 'unreadable'
    }
  }

  return {
    scene,
    issue,
    /** Failed writes can retry; failed reads and conflicting documents stay protected for this session. */
    save(next: Scene): StorageIssue | null {
      if (issue === 'unavailable' || issue === 'unreadable' || issue === 'conflict') return issue
      try {
        // shortcut: this is not an atomic cross-tab lock; add coordination if simultaneous editing is supported.
        if (!storage || storage.getItem(SCENE_STORAGE_KEY) !== expected) return (issue = 'conflict')
        const document = writeSceneDocument(next)
        storage.setItem(SCENE_STORAGE_KEY, document)
        expected = document
        issue = null
      } catch {
        issue = 'write-failed'
      }
      return issue
    },
  }
}
