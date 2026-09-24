import { AssetImage, Typography } from '@/shared/ui'
import type { ProductionStep } from '../../../lib'
import type { ProductionItemsColumnKey } from '../lib/items-columns'

interface CellProps {
  row: ProductionStep
  columnKey: ProductionItemsColumnKey
  itemNameMap: ReadonlyMap<string, string>
}

export const ItemsDiagramCell = ({ row, columnKey, itemNameMap }: CellProps) => {
  switch (columnKey) {
    case 'item':
      return (
        <div className="flex min-w-0 items-center gap-3">
          <AssetImage kind="items" id={row.itemId} width={44} alt="" />
          <Typography as="span" className="min-w-0 break-words">
            {itemNameMap.get(row.itemId) ?? row.itemId}
          </Typography>
        </div>
      )
    case 'needed':
      return (
        <Typography as="span" className="whitespace-nowrap tabular-nums">
          {row.targetIpm.toFixed(2)} units/min
        </Typography>
      )
    default:
      return null
  }
}
