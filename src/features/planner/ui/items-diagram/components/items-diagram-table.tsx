import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react'
import { Typography } from '@/shared/ui'
import type { ProductionStep } from '../../../lib'
import type { ProductionItemsColumn, ProductionItemsColumnKey } from '../lib/items-columns'
import { ItemsDiagramCell } from './items-diagram-cell'

interface ItemsTableProps {
  columns: readonly ProductionItemsColumn[]
  rows: readonly ProductionStep[]
  itemNameMap: ReadonlyMap<string, string>
}

export const ItemsDiagramTable = ({ columns, rows, itemNameMap }: ItemsTableProps) => {
  return (
    <Table removeWrapper isHeaderSticky aria-label="Game item table">
      <TableHeader columns={columns} className="bg-content1/60">
        {(column) => (
          <TableColumn key={column.key} className={`uppercase text-foreground/60 ${column.key === 'needed' ? 'w-36 text-right' : ''}`}>
            <Typography as="span" variant="micro" tone="soft">
              {column.name}
            </Typography>
          </TableColumn>
        )}
      </TableHeader>
      <TableBody emptyContent={'No rows to display.'} items={rows}>
        {(item) => (
          <TableRow key={item.itemId} className="border-b border-divider/60 hover:bg-content1/30 transition-colors">
            {(columnKey) => (
              <TableCell className={columnKey === 'needed' ? 'text-right' : ''}>
                <ItemsDiagramCell row={item} columnKey={columnKey as ProductionItemsColumnKey} itemNameMap={itemNameMap} />
              </TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
