import type { Key } from 'react'

import { AssetImage, Typography } from '@/shared/ui'
import type { BuildingConstructionCostMaterial } from '../../../lib'
import { formatBuildingCostAmount } from '../lib/building-cost-format'

interface BuildingCostCellProps {
  material: BuildingConstructionCostMaterial
  columnKey: Key
  itemNameMap: ReadonlyMap<string, string>
}

/** Display the domain's unit cost and building-type subtotal in distinct numeric columns. */
export const BuildingCostCell = ({ material, columnKey, itemNameMap }: BuildingCostCellProps) => {
  if (columnKey === 'material') {
    return (
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <AssetImage kind="items" id={material.itemId} width={36} alt="" />
        <Typography as="span" className="min-w-0 text-sm wrap-anywhere sm:text-base">
          {itemNameMap.get(material.itemId) ?? material.itemId}
        </Typography>
      </div>
    )
  }

  if (columnKey === 'unit' || columnKey === 'total') {
    return (
      <Typography as="span" className={`whitespace-nowrap tabular-nums ${columnKey === 'total' ? 'text-lg font-semibold' : 'text-base'}`}>
        {formatBuildingCostAmount(columnKey === 'unit' ? material.amountPerBuilding : material.totalAmount)}
      </Typography>
    )
  }
}
