import { beforeEach, describe, expect, it } from 'vitest'
import { useItemsStore } from './items.store'

const EMPTY_FILTERS = {
  selectedCategory: '',
  selectedBuildingId: '',
  searchQuery: '',
}

describe('items store', () => {
  beforeEach(() => {
    useItemsStore.setState({ filters: { ...EMPTY_FILTERS } })
  })

  it('updates each filter while preserving the remaining values', () => {
    const actions = useItemsStore.getState()

    actions.setSelectedCategory('component')
    actions.setSelectedBuildingId('fabricator')
    actions.setSearchQuery('plate')

    expect(useItemsStore.getState().filters).toEqual({
      selectedCategory: 'component',
      selectedBuildingId: 'fabricator',
      searchQuery: 'plate',
    })
  })

  it('resets every filter in one action', () => {
    useItemsStore.setState({
      filters: {
        selectedCategory: 'raw',
        selectedBuildingId: 'excavator',
        searchQuery: 'ore',
      },
    })

    useItemsStore.getState().resetFilter()

    expect(useItemsStore.getState().filters).toEqual(EMPTY_FILTERS)
  })
})
