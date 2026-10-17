import { treeListMockData, type TreeListMockNode } from '@/shared/ui/treelist/tree-list.mock'
import { TreeList, TreeListNode, Typography } from '@/shared/ui'
import { Chip } from '@heroui/react'
import { ComponentPlayground } from '../../components'

const CustomTreeRow = ({ node }: { node: TreeListMockNode }) => (
  <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg px-3 py-2">
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-2">
        <Typography variant="h4" className="truncate">
          {node.label}
        </Typography>
        {node.category ? (
          <Chip size="sm" variant="flat">
            {node.category}
          </Chip>
        ) : null}
      </div>
      {node.description ? (
        <Typography variant="small" tone="soft" className="truncate">
          {node.description}
        </Typography>
      ) : null}
    </div>

    {node.stats?.length ? (
      <div className="hidden sm:flex items-center gap-2">
        {node.stats.map((stat) => (
          <Chip key={stat.label} size="sm" variant="flat" color="primary">
            {stat.label}: {stat.value}
          </Chip>
        ))}
      </div>
    ) : null}
  </div>
)

export const TreeListPlayground = () => {
  return (
    <ComponentPlayground id="treelist" title="TreeList">
      <TreeList data={treeListMockData} className="rounded-xl border border-default bg-content1/30 p-3">
        {({ node, hasChildren, isExpanded, toggle }) => (
          <TreeListNode hasChildren={hasChildren} isExpanded={isExpanded} toggle={toggle} className="hover:bg-content2/70">
            <CustomTreeRow node={node} />
          </TreeListNode>
        )}
      </TreeList>
    </ComponentPlayground>
  )
}
