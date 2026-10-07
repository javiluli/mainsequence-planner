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

const EmptyTableRow = () => (
  <tr className={itemsTableStyles.row}>
    <td colSpan={ITEMS_TABLE_COLUMNS.length} className={itemsTableStyles.emptyCell}>
      No rows to display.
    </td>
  </tr>
)

const TableSpacer = ({ height }: { height: number }) => {
  if (height <= 0) return null

  return (
    <tr aria-hidden>
      <td colSpan={ITEMS_TABLE_COLUMNS.length} style={{ height, padding: 0, border: 0 }} />
    </tr>
  )
}

export const ItemsTableBody = ({ items, virtualRows, totalHeight, measureElement }: ItemsTableBodyProps) => {
  if (items.length === 0) {
    return (
      <tbody className={itemsTableStyles.body}>
        <EmptyTableRow />
      </tbody>
    )
  }

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
