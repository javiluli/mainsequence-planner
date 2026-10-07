import { Input } from '@heroui/react'
import { SearchIcon } from 'lucide-react'
import { useItemsFilters } from '@/features/items/hooks/use-items-filters'

export const SearchInput = () => {
  const { filters, setSearchQuery } = useItemsFilters()

  return (
    <Input
      aria-label="Search items"
      type="search"
      size="sm"
      variant="bordered"
      className="w-full sm:w-50"
      placeholder="Search items"
      startContent={<SearchIcon aria-hidden size={18} />}
      value={filters.searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  )
}
