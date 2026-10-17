import type { ItemTableRow } from '@/features/items/types'
import type { VirtualItem } from '@tanstack/react-virtual'
import { ITEMS_TABLE_COLUMNS } from './items-table-columns'
import { ItemsTableRow } from './items-table-row'
import { itemsTableStyles } from './items-table.styles'

interface ItemsTableBodyProps {
  items: ItemTableRow[]
  virtualRows: VirtualItem[]
  totalHeight: number
  measureElement: (node: Element | null) => void
}

/** Keeps virtual rows at their measured scroll positions without exposing spacer rows to assistive technology. */
const TableSpacer = ({ height }: { height: number }) => {
  if (height <= 0) return null

  return (
    <tr aria-hidden>
      <td colSpan={ITEMS_TABLE_COLUMNS.length} style={{ height, padding: 0, border: 0 }} />
    </tr>
  )
}

/** Renders the visible item slice; the table owner presents empty feedback outside the wide columns. */
export const ItemsTableBody = ({ items, virtualRows, totalHeight, measureElement }: ItemsTableBodyProps) => {
  const firstRow = virtualRows[0]
  const lastRow = virtualRows.at(-1)
  const paddingTop = firstRow?.start ?? 0
  const paddingBottom = lastRow ? totalHeight - lastRow.end : 0

  return (
    <tbody className={itemsTableStyles.body}>
      <TableSpacer height={paddingTop} />
      {virtualRows.map((virtualRow) => {
        const item = items[virtualRow.index]
        return <ItemsTableRow key={item.id} item={item} virtualRow={virtualRow} measureElement={measureElement} />
      })}
      <TableSpacer height={paddingBottom} />
    </tbody>
  )
}
