import { ChevronDown, ChevronRight } from 'lucide-react'
import { memo } from 'react'

import { AssetImage, TreeListNode, Typography } from '@/shared/ui'
import type { TreeListNodeRenderProps } from '@/shared/ui/treelist'
import { getTreeNodeInfo } from '../lib/tree-node-info'
import type { TreeNodeData } from '../types'

interface PlannerTreeRowProps extends TreeListNodeRenderProps<TreeNodeData> {
  itemNameMap: ReadonlyMap<string, string>
}

const rateFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/** Tree quantities describe this branch, not the aggregated machine totals in the Planner toolbar. */
export const PlannerTreeRow = memo(({ node, itemNameMap, hasChildren, isExpanded, toggle }: PlannerTreeRowProps) => {
  const { isSupply, label, itemLabel, iconKind, iconId, showBuildingCount, supplyCount } = getTreeNodeInfo(node, itemNameMap)
  const rate = isSupply ? supplyCount : node.targetIpm
  const Chevron = isExpanded ? ChevronDown : ChevronRight

  return (
    <TreeListNode
      hasChildren={hasChildren}
      isExpanded={isExpanded}
      toggle={toggle}
      className="relative min-w-48 rounded-sm hover:bg-content1/30 sm:min-w-64"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 text-left sm:gap-3">
        <div
          className={`relative shrink-0 rounded-sm border p-1 ${
            node.isFinalProduct
              ? 'border-primary bg-content1'
              : iconKind === 'buildings'
                ? 'border-divider bg-content1'
                : 'border-transparent'
          }`}
        >
          <AssetImage kind={iconKind} id={iconId} width={36} alt="" />
        </div>
        <span aria-hidden className="flex w-4 shrink-0 items-center justify-center text-foreground/80">
          {hasChildren ? <Chevron size={16} /> : null}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <Typography as="span" className={`text-sm font-semibold wrap-anywhere ${node.isFinalProduct ? 'text-primary' : ''}`}>
              {label}
            </Typography>
            {showBuildingCount ? (
              <Typography as="span" variant="small" tone="muted" className="text-xs whitespace-nowrap tabular-nums">
                <span className="font-medium text-foreground">{node.buildingCount?.toLocaleString() ?? '—'}</span>{' '}
                {node.buildingCount === 1 ? 'building' : 'buildings'}
              </Typography>
            ) : null}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {node.isFinalProduct ? null : (
              <Typography as="span" variant="small" tone="muted" className="font-normal wrap-anywhere">
                {node.isRawMaterial ? 'External input' : isSupply ? 'Continuous supply' : itemLabel}
              </Typography>
            )}
            <Typography
              as="span"
              className={`inline-flex items-baseline gap-1 whitespace-nowrap text-sm tabular-nums ${
                node.isFinalProduct ? '' : 'border-l border-divider pl-3'
              }`}
            >
              <span className="font-semibold">{rate === undefined ? '—' : rateFormatter.format(rate)}</span>{' '}
              <span className="text-xs font-normal text-foreground/80">units/min</span>
            </Typography>
          </div>
        </div>
      </div>
    </TreeListNode>
  )
})
