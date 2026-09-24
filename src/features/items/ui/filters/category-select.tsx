import type { ItemType } from '@/shared/@types/item.type'
import { Select, SelectItem } from '@heroui/react'
import { useItemsFilters } from '@/features/items/hooks/use-items-filters'

const CATEGORY_OPTIONS: {
  key: ItemType
  label: string
}[] = [
  { key: 'component', label: 'Component' },
  { key: 'processed', label: 'Processed' },
  { key: 'raw', label: 'Raw' },
]

export const CategorySelect = () => {
  const { filters, setSelectedCategory } = useItemsFilters()
  const selectedKeys = filters.selectedCategory ? [filters.selectedCategory] : []

  return (
    <Select
      aria-label="Filter items by category"
      size="sm"
      variant="bordered"
      className="w-full sm:w-48"
      items={CATEGORY_OPTIONS}
      isClearable={true}
      placeholder="Filter by category"
      selectedKeys={selectedKeys}
      onChange={(e) => setSelectedCategory(e.target.value)}
    >
      {(i) => (
        <SelectItem key={i.key} textValue={i.label}>
          {i.label}
        </SelectItem>
      )}
    </Select>
  )
}
