import { useOpenBases, useOpenPlanner } from '@/features/planner'
import type { Item } from '@/shared/@types/item.type'
import { AssetImage, Flex, Typography } from '@/shared/ui'
import { Button, Chip } from '@heroui/react'

export const ItemCell = ({ item }: { item: Item }) => {
  return (
    <Flex gap="sm">
      <AssetImage kind="items" id={item.id} width={56} alt="" />
      <Typography as="span" variant="body">
        {item.name}
      </Typography>
    </Flex>
  )
}

export const CategoryCell = ({ itemType }: { itemType: string }) => {
  const bgColor = `color-mix(in srgb, var(--color-item-${itemType}), transparent 80%)`

  return (
    <Chip variant="flat" className="text-foreground" style={{ backgroundColor: bgColor }}>
      {itemType}
    </Chip>
  )
}

/** Distinguishes external raw inputs, optional synthesis and coproduct-only producers without inventing a route. */
export const ProductionCell = ({
  itemType,
  producerName,
  byproductProducerName,
}: {
  itemType: Item['type']
  producerName: string | undefined
  byproductProducerName?: string
}) => {
  if (itemType === 'raw') {
    return (
      <Flex direction="col" align="start" gap="none">
        <Typography as="span" variant="small" tone="muted">
          External supply
        </Typography>
        {producerName && (
          <Typography as="span" variant="micro" tone="soft">
            Optional synthesis: {producerName}
          </Typography>
        )}
      </Flex>
    )
  }

  return (
    <Typography as="span" variant="small" tone="muted">
      {producerName ?? (byproductProducerName ? `Byproduct · ${byproductProducerName}` : '—')}
    </Typography>
  )
}

/** Opens the existing Planner/Bases destinations using the catalog item's stable ID. */
export const ActionsCell = ({ item }: { item: Item }) => {
  const openPlanner = useOpenPlanner()
  const openBases = useOpenBases()

  return (
    <Flex>
      <Button size="sm" color="primary" variant="flat" onPress={() => openPlanner(item.id)}>
        Planner
      </Button>
      <Button size="sm" color="primary" variant="bordered" onPress={() => openBases(item.id)}>
        Compare in Bases
      </Button>
    </Flex>
  )
}
