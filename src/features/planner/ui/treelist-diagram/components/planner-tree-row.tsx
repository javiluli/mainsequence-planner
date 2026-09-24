import { AssetImage, Flex, TreeListNode, Typography } from '@/shared/ui'
import type { TreeListNodeRenderProps } from '@/shared/ui/treelist'
import { memo } from 'react'
import { getTreeNodeInfo } from '../lib/tree-node-info'
import type { TreeNodeData } from '../types'

interface PlannerTreeRowProps extends TreeListNodeRenderProps<TreeNodeData> {
  itemNameMap: ReadonlyMap<string, string>
}

const ROW_CONTENT = 'flex items-center gap-3 flex-1 text-left rounded-lg pl-0 pr-2 py-2 transition-colors'

const ICON_BASE = 'relative shrink-0 rounded-xl border-2 p-1 bg-content1 transition-transform duration-200'
const ICON_FINAL = 'border-primary'
const ICON_DEFAULT = 'border-content4'
const ICON_DIM = 'opacity-70'

export const PlannerTreeRow = memo(({ node, itemNameMap, hasChildren, isExpanded, toggle }: PlannerTreeRowProps) => {
  const { isSupply, label, itemLabel, iconKind, iconId, showBuildingCount, supplyCount } = getTreeNodeInfo(node, itemNameMap)

  const iconBorder = node.isFinalProduct ? ICON_FINAL : ICON_DEFAULT
  const iconDim = hasChildren ? '' : ` ${ICON_DIM}`

  return (
    <TreeListNode hasChildren={hasChildren} isExpanded={isExpanded} toggle={toggle} className="hover:bg-content1/30">
      <div className={ROW_CONTENT}>
        <div className={`${ICON_BASE} ${iconBorder}${iconDim}`}>
          <AssetImage kind={iconKind} id={iconId} width={44} alt="" />
        </div>

        <Flex direction="col" align="start" gap="xs" className="min-w-0">
          <Flex gap="xs" align="center" className="min-w-0">
            {node.isFinalProduct ? <Typography variant="h4">{node.targetIpm?.toFixed(0)}x</Typography> : null}
            <Typography variant="h4" className={`${node.isFinalProduct ? 'text-primary' : 'text-foreground'} truncate`}>
              {label}
            </Typography>
            {showBuildingCount ? <Typography variant="h4">(x{node.buildingCount})</Typography> : null}
          </Flex>

          {node.isFinalProduct ? null : (
            <Flex gap="sm" align="center">
              <Typography variant="small" tone="soft">
                {node.isRawMaterial ? 'External input' : isSupply ? 'Continuous supply' : itemLabel}
              </Typography>
              {isSupply ? (
                <Typography variant="small" tone="soft">
                  ({supplyCount.toFixed(1)} units/min)
                </Typography>
              ) : (
                <Typography variant="small" tone="soft">
                  ({node.targetIpm?.toFixed(1)} units/min)
                </Typography>
              )}
            </Flex>
          )}
        </Flex>
      </div>
    </TreeListNode>
  )
})
