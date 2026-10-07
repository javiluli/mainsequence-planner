import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react'
import { AlertTriangle } from 'lucide-react'

import { AssetImage, Typography } from '@/shared/ui'
import type { BuildingConstructionCostRow } from '../../../lib'
import { BuildingCostCell } from './building-cost-cell'

interface BuildingCostTableProps {
  rows: readonly BuildingConstructionCostRow[]
  itemNameMap: ReadonlyMap<string, string>
}

/** Keep the building quantity beside a material table; each subtotal covers that complete building type. */
export const BuildingCostTable = ({ rows, itemNameMap }: BuildingCostTableProps) => (
  <section aria-labelledby="building-cost-detail-title">
    <div className="mb-3">
      <Typography as="h2" id="building-cost-detail-title" variant="h4">
        Buildings to construct
      </Typography>
      <Typography variant="small" tone="muted" className="mt-1">
        Cost per building × buildings required = total for that building type.
      </Typography>
    </div>

    <div className="divide-y divide-divider/60 border-y border-divider/60">
      {rows.map((row) => (
        <div
          key={row.buildingId}
          className="grid min-w-0 items-center gap-3 py-4 transition-colors hover:bg-content1/30 motion-reduce:transition-none md:grid-cols-3 md:gap-6"
        >
          <div className="flex min-w-0 items-center gap-3">
            <AssetImage kind="buildings" id={row.buildingId} width={44} alt="" />
            <div className="min-w-0">
              <Typography as="h3" variant="body" className="text-base font-medium wrap-anywhere">
                {row.buildingName}
              </Typography>
              <Typography variant="small" tone="muted">
                <span className="text-base font-semibold text-foreground tabular-nums">{row.buildingCount}</span>{' '}
                {row.buildingCount === 1 ? 'building required' : 'buildings required'}
              </Typography>
            </div>
          </div>

          <div className="min-w-0 md:col-span-2">
            {!row.hasCostData ? (
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} aria-hidden className="shrink-0 text-warning" />
                <Typography variant="small" tone="muted">
                  Cost data unavailable
                </Typography>
              </div>
            ) : !row.materials.length ? (
              <Typography variant="small" tone="muted" className="italic">
                No construction materials
              </Typography>
            ) : (
              <Table
                removeWrapper
                aria-label={`${row.buildingName} construction costs`}
                classNames={{ table: 'table-fixed', th: 'h-auto py-2', td: 'py-2' }}
              >
                <TableHeader>
                  <TableColumn key="material" className="text-foreground/80">
                    Material
                  </TableColumn>
                  <TableColumn key="unit" className="w-20 text-right whitespace-normal text-foreground/80 sm:w-28">
                    1 building
                  </TableColumn>
                  <TableColumn key="total" className="w-28 text-right whitespace-normal text-foreground sm:w-36">
                    Total for {row.buildingCount} {row.buildingCount === 1 ? 'building' : 'buildings'}
                  </TableColumn>
                </TableHeader>
                <TableBody items={row.materials}>
                  {(material) => (
                    <TableRow key={material.itemId} className="border-b border-divider/40 last:border-b-0">
                      {(columnKey) => (
                        <TableCell className={columnKey === 'material' ? '' : 'text-right'}>
                          <BuildingCostCell material={material} columnKey={columnKey} itemNameMap={itemNameMap} />
                        </TableCell>
                      )}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      ))}
    </div>
  </section>
)
