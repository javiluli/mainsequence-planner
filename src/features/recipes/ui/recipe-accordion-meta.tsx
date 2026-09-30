import type { ReactNode } from 'react'
import { Chip } from '@heroui/react'
import { Zap } from 'lucide-react'
import { Flex, Typography } from '@/shared/ui'
import type { Building } from '@/shared/@types/building.type'

const RecipesChip = ({ count }: { count: number }) => (
  <Chip variant="flat">
    {count} {count === 1 ? 'recipe' : 'recipes'}
  </Chip>
)

const StatBadge = ({ icon, value }: { icon: ReactNode; value: string }) => (
  <Flex align="center" gap="xs">
    {icon}
    <Typography as="span" variant="small" tone="soft">
      {value}
    </Typography>
  </Flex>
)

export const RecipeAccordionMeta = ({ building }: { building: Building }) => (
  <Flex gap="md" align="center" wrap="wrap">
    <RecipesChip count={building.recipes.length} />
    <StatBadge
      icon={<Zap aria-hidden size={14} className="text-warning" />}
      value={building.power === undefined ? 'Unknown energy use' : `${building.power} MJ`}
    />
  </Flex>
)
