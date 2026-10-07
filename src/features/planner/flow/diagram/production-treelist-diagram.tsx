import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'

import { PlannerTreeRow, getTreeNodeKey, type TreeNodeData, useTreeData } from '@/features/planner/ui/treelist-diagram'

import { Flex, TreeList, Typography } from '@/shared/ui'
import { itemNameById } from '@/shared/data'
import { useCallback } from 'react'

// The 46px icon frame is centered at 23px. Indentation controls depth, never the connector anchor.
const TREE_LINES = {
  indentWidthClass: 'w-8 sm:w-10',
  lineXClass: 'left-[var(--tree-icon-center)]',
  lineColorClass: 'bg-divider',
}

export function ProductionTreelistDiagram() {
  const plan = useProductionPlan()
  const treeData = useTreeData(plan?.steps, plan?.supplyCountByItem)
  const getChildren = useCallback((node: TreeNodeData) => node.children ?? [], [])
  const getNodeId = useCallback((node: TreeNodeData, path: string) => getTreeNodeKey(path, node), [])

  if (!treeData) {
    return (
      <Flex align="center" justify="center" className="h-full min-h-0 p-6">
        <Flex align="center" justify="center" direction="col" className="gap-2 py-12 text-center">
          <Typography tone="soft" className="italic">
            No production data available
          </Typography>
          <Typography variant="small" tone="soft">
            This plan uses external inputs only.
          </Typography>
        </Flex>
      </Flex>
    )
  }

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <div className="h-full min-h-0 overflow-auto overscroll-contain px-4 py-4">
        <TreeList
          data={[treeData]}
          getChildren={getChildren}
          getNodeId={getNodeId}
          defaultExpanded
          lineConfig={TREE_LINES}
          className="py-1 [--tree-icon-center:23px]"
        >
          {(nodeProps) => <PlannerTreeRow {...nodeProps} itemNameMap={itemNameById} />}
        </TreeList>
      </div>
    </div>
  )
}
