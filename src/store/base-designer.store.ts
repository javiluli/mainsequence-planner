import { create } from 'zustand'
import type { Building } from '@/features/base-designer/model/buildings'
import type { Splitter, Tunnel } from '@/features/base-designer/model/logistics'
import {
  canPlaceStation,
  DRONE_OUTPUT_KEYS,
  type Point,
  type Scene,
  type Belt,
  type Selection,
  type StationTemplate,
  type Station,
} from '@/features/base-designer/model/scene'
import { itemById } from '@/shared/data'
import { isDroneCargo } from '@/features/base-designer/lib/stations'
import { recipeForBuilding } from '@/features/base-designer/lib/building-recipes'
import { proposePortOutput, validDisabledOutputs } from '@/features/base-designer/lib/output-ports'
import { alignSplitter, canPlaceSplitter, canPlaceTunnel, canPlaceBuilding, canDrawBelt } from '@/features/base-designer/lib/placement'
import { beltToExtend, samePoint } from '@/features/base-designer/lib/belts'
import { cutBeltsAt, joinBeltContinuations } from '@/features/base-designer/lib/belt-edits'
import { checkGroupPlacement } from '@/features/base-designer/lib/clipboard-group'
import { proposeSelectionRemoval } from '@/features/base-designer/lib/selection'
import { proposeSelectionTransform, type SelectionTransform } from '@/features/base-designer/lib/selection-transform'
import { createScenePersistence, type SceneStorage, type StorageIssue } from './base-designer/persistence'

/** Confirmed transactions only; previews and clipboard remain owned by the editor UI.
 * Individual and group edits share explicit-ID transforms/removals and final-layout validation.
 * Mutators return false/null for rejected or unchanged proposals; successful creation returns the confirmed IDs.
 */
interface BaseDesignerState extends Scene {
  splitters: readonly Splitter[]
  tunnels: readonly Tunnel[]
  past: readonly Scene[]
  future: readonly Scene[]
  undo: () => boolean
  redo: () => boolean
  storageIssue: StorageIssue | null
  retrySave: () => void
  addStation: (point: Point & StationTemplate) => string | null
  setDroneCargo: (id: string, slot: 0 | 1, itemId: string | null) => boolean
  addBuilding: (building: Omit<Building, 'id'>) => string | null
  setBuildingRecipe: (id: string, recipeId: string | null) => boolean
  setPortOutput: (target: Selection, key: string, enabled: boolean) => boolean
  addBelt: (belt: Omit<Belt, 'id'>) => string | null
  addSplitter: (splitter: Omit<Splitter, 'id'>) => string | null
  addTunnel: (tunnel: Omit<Tunnel, 'id'>) => string | null
  pasteGroup: (group: Scene, point: Point) => readonly Selection[] | null
  extendBelt: (proposal: { id: string; from: readonly Point[]; points: readonly Point[] }) => boolean
  removeElements: (selection: readonly Selection[]) => boolean
  transformElements: (selection: readonly Selection[], transform: SelectionTransform, from?: Scene) => boolean
}

/** History shares immutable scene collections, excluding actions, storage status and editor UI state. */
function snapshot({ stations, buildings, belts, splitters = [], tunnels = [] }: Scene): Required<Scene> {
  return { stations, buildings, belts, splitters, tunnels }
}

/** Optional storage keeps isolated stores ephemeral; the app restores one independently versioned scene. */
export function createBaseDesignerStore(getStorage?: () => SceneStorage) {
  const persistence = getStorage ? createScenePersistence(getStorage) : null
  const store = create<BaseDesignerState>((set, get) => {
    /** One validated edit creates one history entry and discards the abandoned redo branch. */
    const commit = (changes: Partial<Scene>) => {
      const state = get()
      // Every placement path (catalog, paste or transform) cuts newly occupied splitter cells in this same transaction.
      const placed = (changes.splitters ?? []).filter((piece) => {
        const previous = state.splitters.find((item) => item.id === piece.id)
        return !previous || !samePoint(previous, piece)
      })
      const belts = placed.length
        ? cutBeltsAt({ ...state, ...changes }, placed, state.belts).map((belt) =>
            'id' in belt ? belt : { ...belt, id: `belt-${crypto.randomUUID()}` },
          )
        : (changes.belts ?? state.belts)
      set({ ...changes, belts, past: [...state.past, snapshot(state)].slice(-100), future: [] })
    }
    return {
      ...snapshot(persistence?.scene ?? { stations: [], buildings: [], belts: [] }),
      past: [],
      future: [],
      /** Restore the previous complete scene by reference; clipboard and other UI state belong to the caller. */
      undo: () => {
        const state = get(),
          previous = state.past.at(-1)
        if (!previous) return false
        set({ ...snapshot(previous), past: state.past.slice(0, -1), future: [...state.future, snapshot(state)] })
        return true
      },
      /** Restore the next snapshot without rerunning validation, allocating IDs or creating a new command. */
      redo: () => {
        const state = get(),
          next = state.future.at(-1)
        if (!next) return false
        set({ ...snapshot(next), past: [...state.past, snapshot(state)], future: state.future.slice(0, -1) })
        return true
      },
      storageIssue: persistence?.issue ?? null,
      /** Retry a failed write of the current scene; unreadable or conflicting documents remain protected. */
      retrySave: () => {
        if (!persistence || get().storageIssue !== 'write-failed') return
        const storageIssue = persistence.save(get())
        if (storageIssue !== get().storageIssue) set({ storageIssue })
      },
      /** Validate the footprint and drone configuration before allocating an ID or retaining caller-owned arrays. */
      addStation: (point) => {
        const { stations } = get()
        if (!canPlaceStation(stations, point)) return null
        if (point.type !== 'drone' && 'disabledOutputs' in point && point.disabledOutputs !== undefined) return null
        if (
          point.type === 'drone' &&
          (![0, 90, 180, 270].includes(point.rotation) ||
            !isDroneCargo(point.cargo) ||
            !validDisabledOutputs(point.disabledOutputs, DRONE_OUTPUT_KEYS))
        )
          return null
        const id = `station-${crypto.randomUUID()}`
        const station: Station =
          point.type === 'drone'
            ? {
                id,
                x: point.x,
                y: point.y,
                type: 'drone',
                rotation: point.rotation,
                cargo: [...point.cargo],
                ...(point.name && { name: point.name }),
                ...(point.disabledOutputs && { disabledOutputs: [...point.disabledOutputs] }),
              }
            : { id, x: point.x, y: point.y, ...(point.type ? { type: point.type } : {}), ...(point.name && { name: point.name }) }
        commit({ stations: [...stations, station] })
        return id
      },
      /** Confirm one catalog assignment atomically, including its history and persisted scene. */
      setDroneCargo: (id, slot, itemId) => {
        const scene = get(),
          station = scene.stations.find((s) => s.id === id)
        if (
          !station ||
          station.type !== 'drone' ||
          (slot !== 0 && slot !== 1) ||
          (itemId !== null && !itemById.has(itemId)) ||
          station.cargo[slot] === itemId
        )
          return false
        const cargo: [string | null, string | null] = [...station.cargo]
        cargo[slot] = itemId
        commit({ stations: scene.stations.map((s) => (s.id === id ? { ...station, cargo } : s)) })
        return true
      },
      /** Place a compatible machine on its explicit floor, owning any accepted output-permission array. */
      addBuilding: (building) => {
        const scene = get()
        if (!canPlaceBuilding(scene, building)) return null
        const id = `building-${crypto.randomUUID()}`
        // Accepted configuration must not borrow arrays that callers can later mutate outside a transaction.
        commit({
          buildings: [
            ...scene.buildings,
            { ...building, id, ...(building.disabledOutputs && { disabledOutputs: [...building.disabledOutputs] }) },
          ],
        })
        return id
      },
      /** Confirm or clear one compatible variant; stale and unchanged requests never create history or saves. */
      setBuildingRecipe: (id, recipeId) => {
        const scene = get(),
          building = scene.buildings.find((item) => item.id === id)
        if (!building || (recipeId !== null && !recipeForBuilding(building.type, recipeId)) || (building.recipeId ?? null) === recipeId)
          return false
        const next = { ...building }
        if (recipeId === null) delete next.recipeId
        else next.recipeId = recipeId
        commit({ buildings: scene.buildings.map((item) => (item.id === id ? next : item)) })
        return true
      },
      /** Preserve physical I/O while confirming one supply switch, with no history for stale or unchanged requests. */
      setPortOutput: (target, key, enabled) => {
        const proposal = proposePortOutput(get(), target, key, enabled)
        if (!proposal) return false
        commit(proposal)
        return true
      },
      /** Validate a complete route, merging same-tier continuations in one commit while preserving an existing ID. */
      addBelt: (belt) => {
        const scene = get()
        if ((!belt.heading && belt.points.length < 2) || !canDrawBelt(scene, belt)) return null
        const joined = joinBeltContinuations(scene, {
          points: belt.points,
          ...(belt.type && { type: belt.type }),
          ...(belt.heading && { heading: belt.heading }),
        })
        const id = joined.belt.id ?? `belt-${crypto.randomUUID()}`
        const confirmed = {
          ...joined.belt,
          id,
          points: joined.belt.points.map((point) => ({ ...point })),
          ...(joined.belt.heading && { heading: { ...joined.belt.heading } }),
        }
        const belts = scene.belts.flatMap((existing) =>
          existing.id === id ? [confirmed] : joined.absorbed.has(existing.id) ? [] : [existing],
        )
        if (!scene.belts.some((existing) => existing.id === id)) belts.push(confirmed)
        commit({
          belts,
        })
        return id
      },
      /** Align with an existing straight lane when possible; commit also cuts that lane atomically. */
      addSplitter: (proposal) => {
        const scene = get(),
          splitter = alignSplitter(scene, proposal)
        if (!canPlaceSplitter(scene, splitter)) return null
        const id = `splitter-${crypto.randomUUID()}`
        commit({
          splitters: [
            ...scene.splitters,
            { ...splitter, id, ...(splitter.disabledOutputs && { disabledOutputs: [...splitter.disabledOutputs] }) },
          ],
        })
        return id
      },
      /** Confirm both mouths and output permissions, retaining no caller-owned configuration arrays. */
      addTunnel: (tunnel) => {
        const scene = get()
        if (!canPlaceTunnel(scene, tunnel)) return null
        const id = `tunnel-${crypto.randomUUID()}`
        commit({
          tunnels: [
            ...scene.tunnels,
            {
              id,
              type: tunnel.type,
              entry: { ...tunnel.entry },
              exit: { ...tunnel.exit },
              ...(tunnel.disabledOutputs && { disabledOutputs: [...tunnel.disabledOutputs] }),
            },
          ],
        })
        return id
      },
      /** Revalidate geometry, own accepted configuration arrays, then record one complete paste; existing records stay shared. */
      pasteGroup: (group, point) => {
        const scene = get(),
          { additions } = checkGroupPlacement(scene, group, point)
        if (!additions) return null
        const selected: Selection[] = []
        const allocate = (kind: Selection['kind']) => {
          const id = `${kind}-${crypto.randomUUID()}`
          selected.push({ kind, id })
          return id
        }
        const stationIds = new Map<string, string>()
        const stations = additions.stations.map((station) => {
          const id = allocate('station')
          stationIds.set(station.id, id)
          return {
            ...station,
            id,
            ...(station.type === 'drone' && station.disabledOutputs && { disabledOutputs: [...station.disabledOutputs] }),
          }
        })
        commit({
          stations: [...scene.stations, ...stations],
          buildings: [
            ...scene.buildings,
            ...additions.buildings.map((building) => ({
              ...building,
              id: allocate('building'),
              stationId: stationIds.get(building.stationId) ?? building.stationId,
              ...(building.disabledOutputs && { disabledOutputs: [...building.disabledOutputs] }),
            })),
          ],
          belts: [...scene.belts, ...additions.belts.map((belt) => ({ ...belt, id: allocate('belt') }))],
          splitters: [
            ...scene.splitters,
            ...additions.splitters.map((splitter) => ({
              ...splitter,
              id: allocate('splitter'),
              ...(splitter.disabledOutputs && { disabledOutputs: [...splitter.disabledOutputs] }),
            })),
          ],
          tunnels: [
            ...scene.tunnels,
            ...additions.tunnels.map((tunnel) => ({
              ...tunnel,
              id: allocate('tunnel'),
              ...(tunnel.disabledOutputs && { disabledOutputs: [...tunnel.disabledOutputs] }),
            })),
          ],
        })
        return selected
      },
      /** Revalidate the captured prefix so an obsolete gesture cannot rewrite a newer route. */
      extendBelt: ({ id, from, points }) => {
        const scene = get(),
          belt = scene.belts.find((item) => item.id === id),
          end = from.at(-1)
        if (
          !belt ||
          !end ||
          belt.points.length !== from.length ||
          points.length <= from.length ||
          !from.every((point, i) => samePoint(point, belt.points[i]) && !!points[i] && samePoint(point, points[i])) ||
          beltToExtend(scene, end)?.id !== id ||
          !canDrawBelt(scene, { points }, id)
        )
          return false
        const joined = joinBeltContinuations(scene, { id, points, ...(belt.type && { type: belt.type }) })
        commit({
          belts: scene.belts.flatMap((item) =>
            item.id === id
              ? [{ ...joined.belt, id, points: joined.belt.points.map((point) => ({ ...point })) }]
              : joined.absorbed.has(item.id)
                ? []
                : [item],
          ),
        })
        return true
      },
      /** Revalidate all explicit targets and final floor support; one accepted removal creates one history entry. */
      removeElements: (selection) => {
        const remaining = proposeSelectionRemoval(get(), selection)
        if (!remaining) return false
        commit(snapshot(remaining))
        return true
      },
      /** One final-layout validation and one commit, retaining identities and rejecting obsolete/no-op gestures. */
      transformElements: (selection, transform, from = get()) => {
        const current = get(),
          proposal = proposeSelectionTransform(current, selection, transform, from).scene
        if (!proposal) return false
        const next = snapshot(proposal)
        if (Object.keys(next).every((key) => next[key as keyof Scene] === current[key as keyof Scene])) return false
        commit(next)
        return true
      },
    }
  })
  if (persistence) {
    store.subscribe((scene, previous) => {
      if (
        scene.stations === previous.stations &&
        scene.buildings === previous.buildings &&
        scene.belts === previous.belts &&
        scene.splitters === previous.splitters &&
        scene.tunnels === previous.tunnels
      )
        return
      const storageIssue = persistence.save(scene)
      if (storageIssue !== store.getState().storageIssue) store.setState({ storageIssue })
    })
  }
  return store
}

export const useBaseDesignerStore = createBaseDesignerStore(() => localStorage)
