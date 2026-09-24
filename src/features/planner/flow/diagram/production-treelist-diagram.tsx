import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'

import { PlannerTreeRow, getTreeNodeKey, type TreeNodeData, useTreeData } from '@/features/planner/ui/treelist-diagram'

import { Flex, TreeList, Typography } from '@/shared/ui'
import { itemNameById } from '@/shared/data'
import { useCallback } from 'react'

export function ProductionTreelistDiagram() {
  const plan = useProductionPlan()
  const treeData = useTreeData(plan?.steps, plan?.supplyCountByItem)
  const getChildren = useCallback((node: TreeNodeData) => node.children ?? [], [])
  const getNodeId = useCallback((node: TreeNodeData, path: string) => getTreeNodeKey(path, node), [])

  if (!treeData) {
    return (
      <Flex align="center" justify="center" className="h-full min-h-0 p-6">
        <Flex align="center" justify="center" className="w-full rounded-xl border border-dashed border-divider/70 p-20">
          <Typography tone="soft" className="italic">
            No production data available
          </Typography>
        </Flex>
      </Flex>
    )
  }

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <div className="h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain py-6">
        <TreeList data={[treeData]} getChildren={getChildren} getNodeId={getNodeId} defaultExpanded className="py-2">
          {(nodeProps) => <PlannerTreeRow {...nodeProps} itemNameMap={itemNameById} />}
        </TreeList>
      </div>
    </div>
  )
}
