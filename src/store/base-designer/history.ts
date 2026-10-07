import type { BaseStation } from '@/features/base-designer/lib/layout/placement'
import { pruneDisconnectedBeltJunctions } from '@/features/base-designer/lib/routes/route-operations'
import type { BaseDesignerState } from './types'

export const historyLimit = 50

/** Records one committed action and cleans explicit lateral junctions in the same undo snapshot. Callers validate proposals first. */
export function changed(state: BaseDesignerState, stations: BaseStation[], notes = state.notes): Partial<BaseDesignerState> {
  return {
    stations: stations === state.stations ? stations : pruneDisconnectedBeltJunctions(stations),
    notes,
    past: [...state.past, { stations: state.stations, notes: state.notes }].slice(-historyLimit),
    future: [],
  }
}
