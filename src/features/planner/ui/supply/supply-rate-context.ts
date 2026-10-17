import { createContext, useContext } from 'react'

/** Opens the shared editor for one product, prefilling items/min from demand unless a delivery already exists. */
export interface SupplyRateRequest {
  itemId: string
  itemName: string
  suggestedRate: number
}

export const SupplyRateDialogContext = createContext<((request: SupplyRateRequest) => void) | null>(null)

export const useSupplyRateDialog = () => useContext(SupplyRateDialogContext)
