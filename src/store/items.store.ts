import type { ItemFilterInput } from '@/features/items/types'
import { create } from 'zustand'

interface ItemsStoreState {
  filters: ItemFilterInput
  setSelectedCategory: (value: string) => void
  setSelectedBuildingId: (value: string) => void
  setSearchQuery: (value: string) => void
  resetFilter: () => void
}

const EMPTY_FILTERS: ItemFilterInput = {
  selectedCategory: '',
  selectedBuildingId: '',
  searchQuery: '',
}

export const itemsSelectors = {
  filters: (state: ItemsStoreState) => state.filters,
  setSelectedCategory: (state: ItemsStoreState) => state.setSelectedCategory,
  setSelectedBuildingId: (state: ItemsStoreState) => state.setSelectedBuildingId,
  setSearchQuery: (state: ItemsStoreState) => state.setSearchQuery,
  resetFilter: (state: ItemsStoreState) => state.resetFilter,
}

export const useItemsStore = create<ItemsStoreState>()((set, get) => ({
  filters: EMPTY_FILTERS,
  setSelectedCategory: (value) => set({ filters: { ...get().filters, selectedCategory: value } }),
  setSelectedBuildingId: (value) => set({ filters: { ...get().filters, selectedBuildingId: value } }),
  setSearchQuery: (value) => set({ filters: { ...get().filters, searchQuery: value } }),
  resetFilter: () => set({ filters: EMPTY_FILTERS }),
}))
