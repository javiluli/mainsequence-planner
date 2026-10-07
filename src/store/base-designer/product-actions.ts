import { machinePortKey, machinePorts } from '@/features/base-designer/lib/connections/ports'
import { isProductMachine, recipeForPlaceable, recipeForProduct } from '@/features/base-designer/lib/products/machine-recipes'
import { knownMachineInputItems } from '@/features/base-designer/lib/products/machine-inputs'
import { itemById } from '@/shared/data'
import { changed } from './history'
import type { BaseDesignerState, BaseStoreContext } from './types'

/** Commits validated product changes through the shared transaction/history boundary. */
export function createProductActions({
  set,
  get,
}: BaseStoreContext): Pick<BaseDesignerState, 'assignRecipe' | 'setMachineProduct' | 'toggleMachineOutput' | 'setDroneOutput'> {
  return {
    assignRecipe: (stationId, placementId, recipeId) => {
      const station = get().stations.find((candidate) => candidate.id === stationId)
      const piece = station?.placements.find((placement) => placement.id === placementId)
      if (!piece || !isProductMachine(piece.type)) return false
      if (recipeId !== null && !recipeForPlaceable(piece.type, recipeId)) return false
      if (piece.recipeId === (recipeId ?? undefined)) return true
      set((state) =>
        changed(
          state,
          state.stations.map((candidate) =>
            candidate.id === stationId
              ? {
                  ...candidate,
                  placements: candidate.placements.map((placement) =>
                    placement.id === placementId
                      ? {
                          ...placement,
                          recipeId: recipeId ?? undefined,
                        }
                      : placement,
                  ),
                }
              : candidate,
          ),
        ),
      )
      return true
    },
    setMachineProduct: (stationId, placementId, itemId) => {
      const piece = get()
        .stations.find((station) => station.id === stationId)
        ?.placements.find((placement) => placement.id === placementId)
      if (!piece || !isProductMachine(piece.type)) return false
      const recipe =
        itemId === null ? undefined : recipeForProduct(piece.type, itemId, piece.recipeId, knownMachineInputItems(get().stations, piece.id))
      if (itemId !== null && !recipe) return false
      return get().assignRecipe(stationId, placementId, recipe?.id ?? null)
    },
    toggleMachineOutput: (stationId, placementId, face, offset) => {
      const piece = get()
        .stations.find((station) => station.id === stationId)
        ?.placements.find((placement) => placement.id === placementId)
      if (!piece || !machinePorts(piece).some((port) => port.face === face && port.offset === offset)) return false
      const key = machinePortKey({ face, offset })
      set((state) =>
        changed(
          state,
          state.stations.map((station) =>
            station.id === stationId
              ? {
                  ...station,
                  placements: station.placements.map((placement) =>
                    placement.id === placementId
                      ? {
                          ...placement,
                          disabledOutputPorts: placement.disabledOutputPorts?.includes(key)
                            ? placement.disabledOutputPorts.filter((entry) => entry !== key)
                            : [...(placement.disabledOutputPorts ?? []), key],
                        }
                      : placement,
                  ),
                }
              : station,
          ),
        ),
      )
      return true
    },
    setDroneOutput: (stationId, slot, itemId) => {
      const station = get().stations.find((candidate) => candidate.id === stationId)
      if (station?.type !== 'drone_station' || (itemId !== null && !itemById.has(itemId))) return false
      const outputs = station.droneOutputs ?? [null, null]
      if (outputs[slot] === itemId) return true
      set((state) =>
        changed(
          state,
          state.stations.map((candidate) =>
            candidate.id === stationId
              ? { ...candidate, droneOutputs: slot === 0 ? [itemId, outputs[1]] : [outputs[0], itemId] }
              : candidate,
          ),
        ),
      )
      return true
    },
  }
}
