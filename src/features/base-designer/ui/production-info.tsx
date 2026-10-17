import { Button, Tooltip, AccordionItem } from '@heroui/react'
import { HelpCircle, X } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getCatalogProductionStages, type ProductionPlan } from '@/features/planner'
import { itemNameById } from '@/shared/data'
import { Accordion, AssetImage, Typography } from '@/shared/ui'
import type { Scene } from '../model/scene'
import type { ProductionAnalysis } from '../lib/production-analysis'
import { compareWithPlanner } from '../lib/planner-comparison'
import { machineStatus } from './machine-status'
import { productionAmount as amount } from './production-amount'

const disclosureStyles = { trigger: 'min-h-10 py-2', content: 'space-y-3 pb-3 pt-1' }

/** A catalog icon and labeled rate serve production estimates and Planner comparison. */
function ProductRow({ id, rate, label, details }: { id: string; rate: number | null; label?: string; details?: string }) {
  const row = (
    <div
      tabIndex={details ? 0 : undefined}
      className="flex min-w-0 items-center gap-2 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-warning"
    >
      <AssetImage kind="items" id={id} width={28} alt="" />
      <Typography as="span" variant="small" className="min-w-0 flex-1">
        {itemNameById.get(id) ?? id}
        {label && (
          <Typography as="span" variant="caption" tone="muted" className="block">
            {label}
          </Typography>
        )}
      </Typography>
      <Typography as="span" variant="total" className="shrink-0 tabular-nums">
        {amount(rate)}
        <Typography as="span" variant="caption" tone="muted" className="ml-1">
          /min
        </Typography>
      </Typography>
    </div>
  )
  return details ? (
    <Tooltip content={<Typography variant="caption">{details}</Typography>} delay={0} disableAnimation className="max-w-64">
      {row}
    </Tooltip>
  ) : (
    row
  )
}

/** Lead with input-limited output and missing ingredients, keeping nominal capacity and energy explicit. */
function ProductionSummary({ report }: { report: Pick<ProductionAnalysis, 'products' | 'recipes'> }) {
  const products = useMemo(() => {
    const stages = getCatalogProductionStages(
      report.products.map((row) => row.itemId),
      report.recipes,
    )
    return [...report.products].sort(
      (a, b) =>
        (stages.get(a.itemId) ?? 0) - (stages.get(b.itemId) ?? 0) ||
        (itemNameById.get(a.itemId) ?? a.itemId).localeCompare(itemNameById.get(b.itemId) ?? b.itemId),
    )
  }, [report])
  const outputs = products.filter((row) => row.output > 0),
    inputs = products.filter((row) => row.requiredInput > 0)
  return (
    <>
      {outputs.length ? (
        <div>
          <Typography as="h3" variant="small" className="mb-2">
            Estimated output
          </Typography>
          {outputs.map((row) => (
            <ProductRow
              key={row.itemId}
              id={row.itemId}
              rate={row.estimatedOutput}
              details={`Capacity ${amount(row.output)}/min nominal${row.estimatedOutput === null ? ' · Supply unknown' : ''}`}
            />
          ))}
        </div>
      ) : (
        <Typography variant="small" tone="muted">
          Assign machine recipes to see production.
        </Typography>
      )}
      {inputs.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <Typography as="h3" variant="small">
              Input supply
            </Typography>
            <Typography as="span" variant="caption" tone="muted">
              items/min
            </Typography>
          </div>
          <table className="w-full table-fixed border-collapse" aria-label="Ingredient supply, demand and shortfall in items per minute">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr>
                <Typography as="th" variant="caption" tone="muted" scope="col" className="pb-2 text-left">
                  Item
                </Typography>
                {[
                  ['Supplied', 'Ingredients supplied to machines through connected routes.'],
                  ['Needed', 'Ingredients needed by the active recipes.'],
                  ['Missing', 'Extra ingredients needed for full recipe production.'],
                ].map(([label, explanation]) => (
                  <th key={label} scope="col" className="pb-2 text-right font-normal">
                    <Tooltip
                      content={<Typography variant="caption">{explanation}</Typography>}
                      delay={0}
                      disableAnimation
                      className="max-w-60"
                    >
                      <Typography
                        as="span"
                        variant="caption"
                        tone="muted"
                        tabIndex={0}
                        className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-warning"
                      >
                        {label}
                      </Typography>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inputs.map((row) => {
                const color =
                  row.missingInput !== null && row.missingInput > 1e-7
                    ? machineStatus[row.suppliedInput === 0 ? 'missing-input' : 'shortfall'].color
                    : undefined
                return (
                  <tr key={row.itemId} className="border-t border-divider/50">
                    <Typography as="th" variant="small" scope="row" className="py-2.5 pr-2 text-left">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <AssetImage kind="items" id={row.itemId} width={22} alt="" />
                        <Typography as="span" variant="small" className="min-w-0 break-words">
                          {itemNameById.get(row.itemId) ?? row.itemId}
                        </Typography>
                      </span>
                    </Typography>
                    <Typography as="td" variant="small" className="py-2.5 text-right tabular-nums">
                      {row.suppliedInput === null ? (
                        <Tooltip
                          content={<Typography variant="caption">Supply cannot be estimated for this connection.</Typography>}
                          delay={0}
                          disableAnimation
                          className="max-w-60"
                        >
                          <Typography
                            as="span"
                            variant="small"
                            tabIndex={0}
                            className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-warning"
                          >
                            —
                          </Typography>
                        </Tooltip>
                      ) : (
                        amount(row.suppliedInput)
                      )}
                    </Typography>
                    <Typography as="td" variant="small" className="py-2.5 text-right tabular-nums">
                      {amount(row.requiredInput)}
                    </Typography>
                    <Typography as="td" variant="small" tone="muted" className="py-2.5 text-right tabular-nums" style={{ color }}>
                      {amount(row.missingInput)}
                    </Typography>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/** Whole-base output estimates are independent from canvas selection and per-machine hover details. */
export function ProductionInfo({
  scene,
  analysis,
  plan,
  comparisonRequested,
  onClose,
}: {
  scene: Scene
  analysis: ProductionAnalysis
  plan?: ProductionPlan | null
  comparisonRequested: boolean
  onClose: () => void
}) {
  const comparison = useMemo(() => compareWithPlanner(scene, plan), [scene, plan])
  return (
    <aside
      id="base-production-panel"
      aria-label="Production information"
      className="absolute top-1/2 left-3 z-10 flex h-[90%] max-h-[calc(100%-1.5rem)] w-[26rem] max-w-[calc(100%-1.5rem)] -translate-y-1/2 flex-col rounded-md border border-divider bg-content1 shadow-md"
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-divider px-3 py-2">
        <Typography as="h2" variant="label" className="flex-1">
          Production
        </Typography>
        <Tooltip
          disableAnimation
          content={
            <div className="max-w-64 space-y-2">
              <Typography variant="caption">
                Output estimates follow supplied ingredients. Capacity and energy are nominal; unknown supply stays —.
              </Typography>
              <Typography variant="caption">
                Energy: {amount(analysis.energy.known)} MJ nominal
                {analysis.energy.unknown > 0 ? ` · ${analysis.energy.unknown} elements unknown` : ''}.
              </Typography>
            </div>
          }
        >
          <Button isIconOnly size="sm" variant="light" aria-label="About production analysis">
            <HelpCircle size={17} aria-hidden />
          </Button>
        </Tooltip>
        <Button isIconOnly size="sm" variant="light" aria-label="Close production" onPress={onClose}>
          <X size={18} aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <ProductionSummary report={analysis} />
        {comparisonRequested && (
          <Accordion disableAnimation className="px-0">
            <AccordionItem
              key="comparison"
              title={
                <Typography as="span" variant="small">
                  Planner comparison
                </Typography>
              }
              classNames={disclosureStyles}
            >
              {plan?.issues.length ? (
                plan.issues.map((issue, index) => (
                  <Typography key={index} variant="small" className="text-danger">
                    {issue.message}
                  </Typography>
                ))
              ) : !plan ? (
                <Typography variant="small" tone="muted">
                  Choose a target in Planner.
                </Typography>
              ) : (
                comparison && (
                  <>
                    <ProductRow id={plan.targetId} rate={plan.targetIpm} label="Target" />
                    <Typography variant="caption" tone="muted">
                      Built / required
                    </Typography>
                    {comparison.buildings.map((row) => (
                      <Typography key={row.id} variant="small" className="flex justify-between gap-3">
                        <Typography as="span" variant="small">
                          {row.name}
                        </Typography>
                        <Typography
                          as="span"
                          variant="small"
                          className={'tabular-nums ' + (!row.supported ? 'text-warning' : row.placed < row.needed ? 'text-danger' : '')}
                        >
                          {row.supported ? row.placed + ' / ' + row.needed : 'Not placeable'}
                        </Typography>
                      </Typography>
                    ))}
                    {comparison.products.map((row) => (
                      <ProductRow
                        key={row.itemId}
                        id={row.itemId}
                        rate={row.capacity}
                        label={'Net nominal · needs ' + amount(row.needed) + '/min' + (row.coproductCredit ? ' · includes coproducts' : '')}
                      />
                    ))}
                    {comparison.externalInputs.map((row) => (
                      <ProductRow key={row.itemId} id={row.itemId} rate={row.amountPerMinute} label="External input" />
                    ))}
                    {comparison.supplied.map(([id, rate]) => (
                      <ProductRow key={id} id={id} rate={rate} label="Planner supply" />
                    ))}
                  </>
                )
              )}
              <Button as={Link} to="/" size="sm" variant="flat">
                <Typography as="span" variant="small">
                  Edit in Planner
                </Typography>
              </Button>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </aside>
  )
}
