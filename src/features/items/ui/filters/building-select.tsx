import type { Building } from '@/shared/@types/building.type'
import { productionBuildings } from '@/shared/data'
import { AssetImage, Flex, Typography } from '@/shared/ui'
import { Select, SelectItem } from '@heroui/react'
import { useItemsFilters } from '@/features/items/hooks/use-items-filters'

export const BuildingSelect = () => {
  const { filters, setSelectedBuildingId } = useItemsFilters()
  const selectedKeys = filters.selectedBuildingId ? [filters.selectedBuildingId] : []

  return (
    <Select
      aria-label="Filter items by building"
      size="sm"
      variant="bordered"
      className="w-full sm:w-57.5"
      items={productionBuildings}
      isClearable={true}
      placeholder="Filter by building"
      maxListboxHeight={500}
      selectedKeys={selectedKeys}
      onChange={(e) => setSelectedBuildingId(e.target.value)}
      renderValue={(items) => {
        return items.map((item) => {
          const b = item.data as Building
          return (
            <Flex key={b.id}>
              <AssetImage kind="buildings" id={b.id} width={24} alt="" className="shrink-0" />
              <Typography as="span" variant="small" tone="muted">
                {b.name}
              </Typography>
            </Flex>
          )
        })
      }}
    >
      {(b) => (
        <SelectItem key={b.id} textValue={b.name} data-testid={`items-building-option-${b.id}`}>
          <Flex>
            <AssetImage kind="buildings" id={b.id} width={32} alt="" className="shrink-0" />
            <Typography as="span" variant="small" tone="muted">
              {b.name}
            </Typography>
          </Flex>
        </SelectItem>
      )}
    </Select>
  )
}
