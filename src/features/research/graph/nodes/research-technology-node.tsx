import { researchScienceTypeById } from '@/shared/data'
import { Flex, Typography } from '@/shared/ui'
import { cn } from '@heroui/react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Check, Gift, Network } from 'lucide-react'
import { getTechnologyBranch, RESEARCH_BRANCH_STYLES } from '../config/research-theme'
import type { ResearchFlowNode } from '../types'
import { ResearchIcon } from './research-icon'

/** Shows shared compact labels or readable science-cost detail without changing the graph geometry. */
export const ResearchTechnologyNode = ({ data, selected }: NodeProps<ResearchFlowNode>) => {
  const { technology, contextual, dimmed, independent } = data
  const branchStyle = RESEARCH_BRANCH_STYLES[getTechnologyBranch(technology)]

  return (
    <article
      aria-label={`${technology.name} research technology${independent ? ', independent in game data' : ''}`}
      className={cn(
        'overflow-hidden border bg-content1/95 text-foreground shadow-md shadow-black/25',
        'transition-[border-color,box-shadow,opacity] duration-150 hover:border-foreground/55 motion-reduce:transition-none',
        selected ? 'research-detail h-45.5 rounded-md border-primary/90 shadow-lg' : 'h-14 w-46 rounded-sm border-divider',
        contextual && 'border-dashed bg-content1/78',
        dimmed && 'opacity-20',
      )}
    >
      <Handle type="target" position={Position.Left} className="h-2! w-2! border! border-background! bg-foreground/75!" />

      {selected ? (
        <div className="research-detail-content grid h-full grid-cols-[110px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="research-detail-icon row-span-3">
            <ResearchIcon icon={technology.icon} size={110} />
          </div>

          <Flex align="start" justify="between" gap="sm" className="min-w-0 px-3 pt-2.5">
            <Typography as="h3" variant="h4" className="line-clamp-2">
              {technology.name}
            </Typography>
            {technology.start_unlocked ? <Check size={16} className="shrink-0 text-success" aria-label="Unlocked at start" /> : null}
          </Flex>

          <div className="research-detail-costs nowheel my-2 flex min-h-0 flex-col gap-1 overflow-y-auto px-3">
            {technology.costs.length ? (
              technology.costs.map((cost) => {
                const scienceTypeName = researchScienceTypeById.get(cost.type)?.name ?? cost.type.replaceAll('_', ' ')

                return (
                  <Flex
                    key={cost.type}
                    align="center"
                    justify="between"
                    gap="sm"
                    title={`${scienceTypeName}: ${cost.points.toLocaleString()} points`}
                    aria-label={`${scienceTypeName}: ${cost.points.toLocaleString()} points`}
                  >
                    <Flex align="center" gap="sm" className="min-w-0">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', RESEARCH_BRANCH_STYLES[cost.type].dot)} aria-hidden />
                      <Typography as="span" variant="micro" tone="soft" className="truncate">
                        {scienceTypeName}
                      </Typography>
                    </Flex>
                    <Typography as="span" variant="micro" className="shrink-0 whitespace-nowrap font-mono tabular-nums">
                      {cost.points.toLocaleString()} pts
                    </Typography>
                  </Flex>
                )
              })
            ) : (
              <Typography as="p" variant="micro" tone="soft">
                No science-point cost
              </Typography>
            )}
          </div>

          <Flex align="center" justify="between" gap="sm" className="research-detail-summary mx-3 border-t border-divider/60 py-1.5">
            <Flex align="center" gap="sm">
              <Network size={13} aria-hidden />
              <Typography as="span" variant="micro" tone="soft">
                {independent
                  ? 'No source links'
                  : `${(technology.prerequisites?.length ?? 0) + (technology.primary_prerequisite ? 1 : 0)} requirements`}
              </Typography>
            </Flex>
            <Flex align="center" gap="sm">
              <Gift size={13} aria-hidden />
              <Typography as="span" variant="micro" tone="soft">
                {technology.unlocks.length} unlocks
              </Typography>
            </Flex>
          </Flex>
        </div>
      ) : (
        <Flex align="stretch" gap="none" className="relative h-full">
          <ResearchIcon icon={technology.icon} size={54} />
          <Flex align="center" justify="between" gap="sm" className="min-w-0 flex-1 px-2.5">
            <Typography as="h3" variant="label" className="line-clamp-2">
              {technology.name}
            </Typography>
            {technology.start_unlocked ? <Check size={14} className="shrink-0 text-success" aria-label="Unlocked at start" /> : null}
          </Flex>
          <span className={cn('absolute inset-x-0 top-0 h-0.5', branchStyle.dot)} aria-hidden />
        </Flex>
      )}

      <Handle type="source" position={Position.Right} className="h-2! w-2! border! border-background! bg-foreground/75!" />
    </article>
  )
}
