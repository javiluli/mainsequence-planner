import { useProductionPlan } from '@/features/planner'
import { Button, Popover, PopoverContent, PopoverTrigger } from '@heroui/react'
import { ListChecks } from 'lucide-react'
import { itemNameById } from '@/shared/data'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { BaseStation } from '../lib/placement'
import { summarizePlanComparison } from '../lib/plan-comparison'

export function BasePlanComparison({ stations }: { stations: readonly BaseStation[] }) {
  const plan = useProductionPlan()
  const comparison = useMemo(() => (plan ? summarizePlanComparison(plan, stations) : null), [plan, stations])
  if (!plan || !comparison) return null

  return (
    <Popover placement="bottom-start" disableAnimation>
      <PopoverTrigger>
        <Button size="sm" variant="flat" startContent={<ListChecks size={14} aria-hidden />}>
          Planner reference
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Planner reference" className="rounded-sm border border-divider bg-content1 p-0 shadow-none">
        <div className="max-h-[min(24rem,60dvh)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-3 text-xs">
          <h2 className="mb-2 font-semibold text-foreground">Planner reference · {itemNameById.get(plan.targetId) ?? plan.targetId}</h2>
          <p className="text-foreground/70">Planner target: {plan.targetIpm.toFixed(1)} items/min.</p>
          {plan.issues.length ? (
            <p className="mt-2 text-warning">The Planner cannot calculate this target. Check its rate and recipe dependencies.</p>
          ) : comparison.machines.length ? (
            <section aria-label="Global machine inventory" className="mt-3">
              <div className="mb-1.5 flex items-center justify-between gap-2 font-medium text-foreground">
                <span>Machines · whole base</span>
                <span className="shrink-0 text-foreground/65">Placed / planned</span>
              </div>
              <ul className="space-y-1.5">
                {comparison.machines.map((row) => (
                  <li key={row.buildingId} className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words">{row.name}</span>
                    <span className="shrink-0 text-right tabular-nums text-foreground/75">
                      {row.placed === null ? `Not in palette · ${row.required} planned` : `${row.placed} / ${row.required}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-foreground/65">Counts are by machine type, not by assigned recipe or connected production step.</p>
            </section>
          ) : (
            <p className="mt-2 text-foreground/70">No production machines in this plan; the target is supplied externally.</p>
          )}
          <p className="mt-3 border-t border-divider pt-2 text-foreground/70">
            Belt cells: {comparison.mk1BeltCells} Mk1 · {comparison.mk2BeltCells} Mk2. Nominal capacity per belt: Mk1{' '}
            {comparison.mk1Capacity}
            /min, Mk2 {comparison.mk2Capacity}/min.
          </p>
          <p className="mt-2 text-foreground/65">No item flow, belt load or recipe coverage is calculated here.</p>
          <Link
            to="/"
            className="mt-2 inline-block text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Edit plan in Planner
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
