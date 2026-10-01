import { Button } from '@heroui/react'
import { ChevronDown, Factory } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProductionPlan } from '@/features/planner'
import { itemNameById } from '@/shared/data'
import { baseBuildingRows } from '../lib/plan-comparison'
import type { BaseStation } from '../lib/placement'

export const BaseBuildingsPanel = memo(function BaseBuildingsPanel({
  stations,
  plan,
}: {
  stations: readonly BaseStation[]
  plan: ProductionPlan | null
}) {
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => baseBuildingRows(stations, plan), [stations, plan])
  const compares = Boolean(plan && !plan.issues.length)
  const total = rows.reduce((sum, row) => sum + (row.placed ?? 0), 0)
  return (
    <aside
      aria-label="Base buildings"
      className="flex min-h-0 shrink-0 flex-col border-b border-divider bg-content1 md:w-64 md:border-r md:border-b-0"
    >
      <div className="hidden items-center gap-2 px-3 pt-3 pb-2 md:flex">
        <Factory size={15} aria-hidden className="text-primary" />
        <h2 className="flex-1 text-sm font-semibold">Buildings</h2>
        <span className="text-xs text-foreground/75 tabular-nums">{total}</span>
      </div>
      <Button
        variant="light"
        size="sm"
        className="h-9 w-full justify-between rounded-none px-3 md:hidden"
        aria-expanded={expanded}
        aria-controls="base-buildings-list"
        onPress={() => setExpanded((value) => !value)}
        startContent={<Factory size={15} aria-hidden className="text-primary" />}
        endContent={<ChevronDown size={14} aria-hidden className={expanded ? 'rotate-180' : ''} />}
      >
        Buildings · {total}
        {compares ? ' · Planner reference' : ''}
      </Button>
      <div
        id="base-buildings-list"
        className={`${expanded ? 'block' : 'hidden'} min-h-0 max-h-48 overflow-y-auto overscroll-contain px-3 pb-3 md:block md:max-h-none md:flex-1`}
      >
        {plan ? (
          <div className="mb-3 text-xs">
            <p className="break-words font-medium text-foreground/85">{itemNameById.get(plan.targetId) ?? plan.targetId}</p>
            {plan.issues.length ? <p className="mt-1 text-warning">This plan cannot be calculated. Only built counts are shown.</p> : null}
            <Link
              to="/"
              className="mt-1 inline-block text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Edit in Planner
            </Link>
          </div>
        ) : null}
        {rows.length ? (
          <table className="w-full text-xs">
            <thead className="border-b border-divider text-foreground/75">
              <tr>
                <th scope="col" className="py-2 text-left font-medium">
                  Building
                </th>
                <th scope="col" className="py-2 pl-2 text-right font-medium">
                  Built
                </th>
                {compares ? (
                  <th scope="col" className="py-2 pl-2 text-right font-medium">
                    Required
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-divider/50 last:border-0">
                  <th scope="row" className="py-2 text-left font-normal break-words">
                    {row.name}
                  </th>
                  <td className="py-2 pl-2 text-right align-top tabular-nums">
                    {row.placed === null ? <span title="This building is not in the current build palette">—</span> : row.placed}
                  </td>
                  {compares ? <td className="py-2 pl-2 text-right align-top tabular-nums">{row.required}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-2 text-xs text-foreground/75">
            {compares ? 'This plan needs no production buildings.' : 'Place a building to see its count here.'}
          </p>
        )}
        {rows.some((row) => row.placed === null) ? (
          <p className="mt-2 text-xs text-foreground/75">— Not available in the build palette.</p>
        ) : null}
      </div>
    </aside>
  )
})
