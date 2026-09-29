import { createContext, useContext } from 'react'

export interface SupplyRateRequest {
  itemId: string
  itemName: string
  suggestedRate: number
}

export const SupplyRateDialogContext = createContext<((request: SupplyRateRequest) => void) | null>(null)

export const useSupplyRateDialog = () => useContext(SupplyRateDialogContext)
