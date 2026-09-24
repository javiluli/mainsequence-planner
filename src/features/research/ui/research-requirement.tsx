import { researchScienceTypeById } from '@/shared/data'
import { Chip } from '@heroui/react'
import { Flex, Typography } from '@/shared/ui'
import { getRecipeResearchRequirements } from '../lib/research-requirements'

const formatScienceType = (type: string) => researchScienceTypeById.get(type)?.name ?? type.replaceAll('_', ' ')

const formatCosts = (costs: readonly { type: string; points: number }[]) => {
  if (!costs.length) return 'Research unlock'

  return costs.map((cost) => cost.points + ' ' + formatScienceType(cost.type)).join(' + ')
}

export const ResearchRequirement = ({ recipeId, compact = false }: { recipeId?: string; compact?: boolean }) => {
  const requirements = getRecipeResearchRequirements(recipeId)

  if (!requirements.length) return null

  return (
    <div
      className={
        compact
          ? 'rounded-md border border-primary/15 bg-primary/5 px-3 py-2'
          : 'mt-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5'
      }
      aria-label="Research requirements"
    >
      <Flex align="center" gap="sm" wrap="wrap">
        <Chip size="sm" variant="flat" className="border border-primary/20 bg-primary/10 text-primary">
          Research
        </Chip>
        <Typography as="span" variant="small" className="min-w-0">
          {requirements.map(({ technology }) => technology.name).join(' · ')}
        </Typography>
      </Flex>

      <div className="mt-1 space-y-0.5">
        {requirements.map(({ technology, prerequisites }) => (
          <Typography key={technology.id} as="p" variant="micro" tone="soft">
            {formatCosts(technology.costs)}
            {prerequisites.length ? ' · Requires ' + prerequisites.map((prerequisite) => prerequisite.name).join(', ') : ''}
          </Typography>
        ))}
      </div>

      <Typography as="p" variant="micro" tone="soft" className="mt-1">
        Planning remains available; research state is not tracked.
      </Typography>
    </div>
  )
}
