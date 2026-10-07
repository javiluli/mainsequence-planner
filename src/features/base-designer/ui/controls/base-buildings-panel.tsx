import { Button, Tooltip } from '@heroui/react'
import { ArrowDown, Check, Factory, Package, PanelLeft, X } from 'lucide-react'
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProductionPlan } from '@/features/planner'
import { buildings, itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui'
import { baseBuildingRows, baseProductRows, type BaseProductRow } from '../../lib/products/plan-comparison'
import { catalogBuildingForPlaceable } from '../../lib/products/catalog-machines'
import type { BaseStation } from '../../lib/layout/placement'

const rateFormat = new Intl.NumberFormat('en', { maximumSignificantDigits: 6 })
const catalogBuildingIds = new Set(buildings.map((building) => building.id))

/** Color compares capacity/counts only: a nominal surplus never proves ingredient coverage or belt delivery. */
function ComparisonAmount({ value, target, nominal = false }: { value: number; target: number | null; nominal?: boolean }) {
  const compared = target !== null && target > 0
  // Ignore floating-point noise in derived recipe rates, without changing the underlying calculation.
  const enough = compared && value >= target - 1e-6
  const Status = enough ? Check : ArrowDown
  const description = compared
    ? `${nominal ? 'Nominal output' : 'Built count'} ${enough ? 'meets or exceeds' : 'is below'} ${nominal ? 'the target' : 'the requirement'}`
    : undefined
  return (
    <span
      className={`inline-flex items-center justify-end gap-1 font-semibold tabular-nums ${
        compared ? (enough ? 'text-success' : 'text-warning') : 'text-foreground'
      }`}
      title={description}
    >
      {compared ? <Status size={12} aria-hidden className="shrink-0" /> : null}
      {nominal ? rateFormat.format(value) : value.toLocaleString('en')}
      {description ? <span className="sr-only"> — {description}</span> : null}
    </span>
  )
}

/** Non-modal disclosure above the canvas: opening it changes neither viewport nor editing context. */
export const BaseBuildingsPanel = memo(function BaseBuildingsPanel({
  stations,
  plan,
}: {
  stations: readonly BaseStation[]
  plan: ProductionPlan | null
}) {
  const [open, setOpen] = useState(true)
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(true)
  const rows = useMemo(() => baseBuildingRows(stations, plan), [stations, plan])
  const products = useMemo(() => baseProductRows(stations, plan), [stations, plan])
  const productStages = useMemo(() => {
    const groups = new Map<number, BaseProductRow[]>()
    for (const product of products) {
      const group = groups.get(product.stage)
      if (group) group.push(product)
      else groups.set(product.stage, [product])
    }
    return [...groups].map(([stage, items]) => ({ stage, items }))
  }, [products])
  const compares = Boolean(plan && !plan.issues.length)
  const total = rows.reduce((sum, row) => sum + (row.placed ?? 0), 0)

  useEffect(() => {
    if (open && !wasOpenRef.current) closeRef.current?.focus()
    wasOpenRef.current = open
  }, [open])

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[min(26rem,calc(100%-3rem))]">
      <div inert={open} aria-hidden={open} className={`absolute top-1/2 left-0 -translate-y-1/2 ${open ? 'invisible' : ''}`}>
        <Tooltip placement="right" content={`Buildings / Items · ${total} built`}>
          <Button
            ref={triggerRef}
            isIconOnly
            variant="flat"
            size="sm"
            aria-label="Buildings and items"
            aria-expanded={open}
            aria-controls={panelId}
            onPress={() => setOpen(true)}
            className="pointer-events-auto h-12 rounded-l-none rounded-r-sm border border-l-0 border-divider bg-content1"
          >
            <PanelLeft size={18} aria-hidden className="text-primary" />
          </Button>
        </Tooltip>
      </div>
      <aside
        id={panelId}
        aria-labelledby={`${panelId}-title`}
        aria-hidden={!open}
        inert={!open}
        onKeyDown={(event) => {
          // Escape belongs to this disclosure only while focus is inside; canvas Escape still cancels editing.
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        }}
        className={`absolute top-1/2 right-0 left-3 flex max-h-[calc(100%-1.5rem)] -translate-y-1/2 flex-col rounded-sm border border-divider bg-content1 transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? 'pointer-events-auto translate-x-0' : 'pointer-events-none -translate-x-[calc(100%+1rem)]'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-divider px-4 py-3">
          <div className="flex items-center gap-2">
            <PanelLeft size={17} aria-hidden className="text-primary" />
            <h2 id={`${panelId}-title`} className="text-sm font-semibold">
              Buildings / Items
            </h2>
          </div>
          <Button ref={closeRef} isIconOnly variant="light" size="sm" aria-label="Close buildings and items" onPress={close}>
            <X size={17} aria-hidden />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {plan ? (
            <div className="mb-4 border-b border-divider pb-3 text-xs">
              <p className="wrap-break-word font-medium text-foreground/85">{itemNameById.get(plan.targetId) ?? plan.targetId}</p>
              {plan.issues.length ? (
                <p className="mt-1 text-warning">
                  This plan cannot be calculated. Only built counts and assigned nominal outputs are shown.
                </p>
              ) : null}
              <Link
                to="/"
                className="mt-1 inline-block text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Edit in Planner
              </Link>
            </div>
          ) : null}
          <section aria-labelledby={`${panelId}-buildings`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 id={`${panelId}-buildings`} className="flex items-center gap-2 text-sm font-semibold">
                <Factory size={15} aria-hidden className="text-foreground/80" />
                Buildings
              </h3>
              <span className="text-xs text-foreground/80">
                <strong className="font-semibold text-foreground tabular-nums">{total}</strong> built
              </span>
            </div>
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
                  {rows.map((row) => {
                    const iconId = row.id === 'assembler' ? catalogBuildingForPlaceable('assembler')?.id : row.id
                    // Palette-only structures have no source texture. Keep their identity explicit with a neutral icon.
                    const hasCatalogIcon = iconId !== undefined && catalogBuildingIds.has(iconId)
                    return (
                      <tr key={row.id} className="border-b border-divider/50 last:border-0 hover:bg-content2/40">
                        <th scope="row" className="py-2 text-left font-normal">
                          <div className="flex items-center gap-2">
                            {hasCatalogIcon && iconId ? (
                              <AssetImage kind="buildings" id={iconId} width={28} alt="" />
                            ) : (
                              <Factory size={24} aria-hidden className="shrink-0 text-foreground/75" />
                            )}
                            <span className="min-w-0 wrap-break-word">{row.name}</span>
                          </div>
                        </th>
                        <td className="py-2 pl-2 text-right tabular-nums">
                          {row.placed === null ? (
                            <span title="This building is not in the current build palette">—</span>
                          ) : (
                            <ComparisonAmount value={row.placed} target={row.required} />
                          )}
                        </td>
                        {compares ? <td className="py-2 pl-2 text-right tabular-nums">{row.required}</td> : null}
                      </tr>
                    )
                  })}
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
          </section>
          <section aria-labelledby={`${panelId}-items`} className="mt-5 border-t border-divider pt-4">
            <h3 id={`${panelId}-items`} className="flex items-center gap-2 text-sm font-semibold">
              <Package size={15} aria-hidden className="text-foreground/80" />
              Items
            </h3>
            <p
              className="mt-2 text-xs leading-relaxed text-foreground/75"
              title="Full-speed catalog output, including co-products before recycling. Net Planner targets do not prove ingredient coverage."
            >
              Nominal output{compares ? ' vs net demand' : ''}, not belt delivery.
            </p>
            {products.length ? (
              <table className="mt-3 w-full text-xs">
                <thead className="border-b border-divider text-foreground/75">
                  <tr>
                    <th scope="col" className="py-2 text-left font-medium">
                      Item
                    </th>
                    <th scope="col" className="py-2 pl-2 text-right font-medium">
                      Nominal /min
                    </th>
                    {compares ? (
                      <th scope="col" className="py-2 pl-2 text-right font-medium">
                        Target /min
                      </th>
                    ) : null}
                  </tr>
                </thead>
                {productStages.map(({ stage, items }) => (
                  <tbody key={stage}>
                    <tr>
                      <th
                        scope="rowgroup"
                        colSpan={compares ? 3 : 2}
                        className="border-t border-divider pt-4 pb-1.5 text-left font-semibold text-foreground/80"
                      >
                        {stage === 0 ? 'Inputs' : `Stage ${stage}`}
                      </th>
                    </tr>
                    {items.map((row) => (
                      <tr key={row.id} className="border-b border-divider/50 last:border-0 hover:bg-content2/40">
                        <th scope="row" className="py-2 text-left font-normal">
                          <div className="flex items-center gap-2">
                            <AssetImage kind="items" id={row.id} width={28} alt="" />
                            <span className="min-w-0 wrap-break-word">{row.name}</span>
                          </div>
                        </th>
                        <td className="py-2 pl-2 text-right">
                          <ComparisonAmount value={row.nominal} target={row.target} nominal />
                        </td>
                        {compares ? <td className="py-2 pl-2 text-right tabular-nums">{rateFormat.format(row.target ?? 0)}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            ) : (
              <p className="mt-3 text-xs text-foreground/75">Assign a product to a machine to see its nominal output.</p>
            )}
          </section>
          {compares ? (
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/80">
              <span className="inline-flex items-center gap-1">
                <Check size={12} aria-hidden className="text-success" />
                Meets or exceeds target
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowDown size={12} aria-hidden className="text-warning" />
                Below target
              </span>
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  )
})
