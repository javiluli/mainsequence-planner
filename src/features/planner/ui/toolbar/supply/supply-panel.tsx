import { itemNameById } from '@/shared/data'
import { Typography } from '@/shared/ui'
import { SupplyCard } from './supply-card'

interface SupplyPanelProps {
  supplyCountByItem: Record<string, number>
  supplyItemIds: string[]
}

export const SupplyPanel = ({ supplyCountByItem, supplyItemIds }: SupplyPanelProps) => {
  return (
    <div className="min-w-0">
      {supplyItemIds.length ? (
        <ul className="divide-y divide-divider/60">
          {supplyItemIds.map((id) => (
            <SupplyCard key={id} itemId={id} itemName={itemNameById.get(id) ?? id.replaceAll('_', ' ')} value={supplyCountByItem[id]} />
          ))}
        </ul>
      ) : (
        <Typography variant="small" tone="soft" className="block px-2 py-3 text-center">
          No supply configured. Add it from a graph node.
        </Typography>
      )}
    </div>
  )
}
