import { Typography } from '@/shared/ui'
import { ITEMS_TABLE_COLUMNS, ITEMS_TABLE_COLUMN_WIDTHS } from './items-table-columns'
import { itemsTableStyles } from './items-table.styles'

export const ItemsTableHeader = () => (
  <>
    <colgroup>
      {ITEMS_TABLE_COLUMNS.map((column) => (
        <col key={column.key} style={{ width: ITEMS_TABLE_COLUMN_WIDTHS[column.key] }} />
      ))}
    </colgroup>

    <thead className={itemsTableStyles.head}>
      <tr aria-rowindex={1} className={itemsTableStyles.row}>
        {ITEMS_TABLE_COLUMNS.map((column) => (
          <th key={column.key} scope="col" className={itemsTableStyles.headerCell}>
            <Typography as="span" variant="micro" tone="soft" className="text-foreground/70">
              {column.name}
            </Typography>
          </th>
        ))}
      </tr>
    </thead>
  </>
)
