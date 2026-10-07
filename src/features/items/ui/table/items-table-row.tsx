import type { ItemTableRow } from '@/features/items/types'
import type { VirtualItem } from '@tanstack/react-virtual'
import { ActionsCell, CategoryCell, ItemCell, ProductionCell } from './items-table-cells'
import { ITEMS_TABLE_COLUMNS, type ColumnKey } from './items-table-columns'
import { itemsTableStyles } from './items-table.styles'

interface ItemsTableRowProps {
  item: ItemTableRow
  virtualRow: VirtualItem
  measureElement: (node: Element | null) => void
}

const renderCell = (item: ItemTableRow, columnKey: ColumnKey) => {
  switch (columnKey) {
    case 'item':
      return <ItemCell item={item} />
    case 'category':
      return <CategoryCell itemType={item.type} />
    case 'production':
      return (
        <ProductionCell itemType={item.type} producerName={item.primaryProducerName} byproductProducerName={item.byproductProducerName} />
      )
    case 'actions':
      return <ActionsCell item={item} />
  }
}

export const ItemsTableRow = ({ item, virtualRow, measureElement }: ItemsTableRowProps) => (
  <tr ref={measureElement} data-index={virtualRow.index} aria-rowindex={virtualRow.index + 2} className={itemsTableStyles.row}>
    {ITEMS_TABLE_COLUMNS.map((column) => (
      <td key={column.key} className={itemsTableStyles.cell}>
        {renderCell(item, column.key)}
      </td>
    ))}
  </tr>
)
