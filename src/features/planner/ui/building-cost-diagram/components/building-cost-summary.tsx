import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react'

import { AssetImage, Typography } from '@/shared/ui'
import type { BuildingConstructionMaterialTotal } from '../../../lib'
import { formatBuildingCostAmount } from '../lib/building-cost-format'

interface BuildingCostSummaryProps {
  materials: readonly BuildingConstructionMaterialTotal[]
  itemNameMap: ReadonlyMap<string, string>
  hasUnknownCosts: boolean
}

/** Aggregate each material across every building type; unknown costs remain explicitly excluded. */
export const BuildingCostSummary = ({ materials, itemNameMap, hasUnknownCosts }: BuildingCostSummaryProps) => {
  // Quantity order is presentation only: never reorder the domain summary shared by consumers.
  const sortedMaterials = [...materials].sort((a, b) => b.totalAmount - a.totalAmount)
  return (
    <section aria-labelledby="building-cost-summary-title" className="grid gap-3 md:grid-cols-3 md:gap-6">
      <div>
        <Typography as="h2" id="building-cost-summary-title" variant="h4">
          Total materials for the plan
        </Typography>
        <Typography variant="small" tone="muted" className="mt-1">
          {hasUnknownCosts
            ? 'Partial total: buildings without cost data are excluded.'
            : 'Combined construction costs for all required buildings.'}
        </Typography>
      </div>
      {sortedMaterials.length ? (
        <Table
          removeWrapper
          aria-label="Total construction materials for the plan"
          className="min-w-0 md:col-span-2"
          classNames={{ table: 'table-fixed', th: 'h-auto py-2', td: 'py-2' }}
        >
          <TableHeader>
            <TableColumn className="text-foreground/80">Material</TableColumn>
            <TableColumn className="w-28 text-right whitespace-normal text-foreground sm:w-36">Total for the plan</TableColumn>
          </TableHeader>
          <TableBody items={sortedMaterials}>
            {(material) => (
              <TableRow
                key={material.itemId}
                className="border-b border-divider/60 transition-colors last:border-b-0 hover:bg-content1/30 motion-reduce:transition-none"
              >
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <AssetImage kind="items" id={material.itemId} width={36} alt="" />
                    <Typography as="span" className="min-w-0 text-base wrap-anywhere">
                      {itemNameMap.get(material.itemId) ?? material.itemId}
                    </Typography>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Typography as="span" className="whitespace-nowrap text-lg font-semibold tabular-nums">
                    {formatBuildingCostAmount(material.totalAmount)}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : (
        <Typography variant="small" tone="muted" className="py-2 md:col-span-2">
          {hasUnknownCosts ? 'No known construction materials to summarize.' : 'No construction materials required.'}
        </Typography>
      )}
    </section>
  )
}
