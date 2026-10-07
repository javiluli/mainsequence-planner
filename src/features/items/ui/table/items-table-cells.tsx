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

export const ActionsCell = ({ item }: { item: Item }) => {
  const openPlanner = useOpenPlanner()
  const openBases = useOpenBases()

  return (
    <Flex>
      <Button size="sm" onPress={() => openPlanner(item.id)}>
        Planner
      </Button>
      <Button size="sm" variant="flat" onPress={() => openBases(item.id)}>
        Compare in Bases
      </Button>
    </Flex>
  )
}
