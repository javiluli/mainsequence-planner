import type { ItemTableRow } from '@/features/items/types'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { ItemsTableBody } from './items-table-body'
import { ITEMS_TABLE_ESTIMATED_ROW_HEIGHT, ITEMS_TABLE_OVERSCAN } from './items-table-columns'
import { ItemsTableHeader } from './items-table-header'
import { itemsTableStyles } from './items-table.styles'

interface ItemsTableProps {
  items: ItemTableRow[]
}

export const ItemsTable = ({ items }: ItemsTableProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  // TanStack Virtual returns functions that React Compiler cannot memoize safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEMS_TABLE_ESTIMATED_ROW_HEIGHT,
    getItemKey: (index) => items[index].id,
    overscan: ITEMS_TABLE_OVERSCAN,
  })

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="px-3 py-2 text-xs text-foreground-500 sm:hidden">Swipe sideways to see all item details.</p>
      <div ref={scrollRef} className={itemsTableStyles.base}>
        <table aria-label="Game items catalog" aria-rowcount={items.length + 1} className={itemsTableStyles.table}>
          <ItemsTableHeader />
          <ItemsTableBody
            items={items}
            virtualRows={virtualRows}
            totalHeight={virtualizer.getTotalSize()}
            measureElement={virtualizer.measureElement}
          />
        </table>
      </div>
    </div>
  )
}
