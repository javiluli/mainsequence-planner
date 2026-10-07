import { Tab, Tabs } from '@heroui/react'
import { Factory, ListTree, Network, Package, type LucideIcon } from 'lucide-react'
import { lazy, useCallback, useState, type ComponentType } from 'react'

import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { PlannerDiagramReveal } from './diagram-reveal'
import { NoProductionRoute } from './no-production-route'
import { ProductionBuildingCostDiagram } from './production-building-cost-diagram'
import { ProductionItemsDiagram } from './production-items-diagram'
import { ProductionTreelistDiagram } from './production-treelist-diagram'
import { RawTargetDiagram } from './raw-target-diagram'

const ProductionFlowDiagram = lazy(() =>
  import('./production-flow-diagram').then((module) => ({
    default: module.ProductionFlowDiagram,
  })),
)

type DiagramTab = {
  key: string
  label: string
  icon: LucideIcon
  component: ComponentType
}

const DIAGRAM_TABS: DiagramTab[] = [
  {
    key: 'network-graph',
    label: 'Network graph',
    icon: Network,
    component: ProductionFlowDiagram,
  },
  {
    key: 'tree-list',
    label: 'Tree list',
    icon: ListTree,
    component: ProductionTreelistDiagram,
  },
  {
    key: 'items',
    label: 'Items',
    icon: Package,
    component: ProductionItemsDiagram,
  },
  {
    key: 'buildings',
    label: 'Buildings',
    icon: Factory,
    component: ProductionBuildingCostDiagram,
  },
]

export function ProductionDiagramTabs() {
  const plan = useProductionPlan()
  const [readyTargetId, setReadyTargetId] = useState<string | null>(null)
  const targetId = plan?.targetId

  const markTargetReady = useCallback(() => {
    if (targetId !== undefined) setReadyTargetId(targetId)
  }, [targetId])

  if (!plan) return null

  if (plan.isRawTarget) {
    return (
      <PlannerDiagramReveal
        key={plan.targetId}
        label="raw material"
        Content={RawTargetDiagram}
        skipLoading={readyTargetId === plan.targetId}
        onRevealReady={markTargetReady}
      />
    )
  }

  return (
    <Tabs
      fullWidth
      placement="top"
      variant="underlined"
      aria-label="Production diagram views"
      classNames={{
        tabWrapper: 'flex h-full min-h-0 w-full flex-col overflow-hidden',
        base: 'w-full shrink-0 border-b border-divider/60',
        tabList: 'w-full gap-1 sm:gap-2',
        tab: 'px-2 sm:px-3',
        panel: 'min-h-0 flex-1 overflow-hidden p-0',
      }}
    >
      {DIAGRAM_TABS.map(({ key, label, icon: Icon, component: Content }) => (
        <Tab
          key={key}
          title={
            <span className="flex items-center gap-2">
              <Icon size={18} aria-hidden className="hidden sm:block" />
              {label}
            </span>
          }
        >
          <PlannerDiagramReveal
            key={`${plan.targetId}:${plan.issues.length ? 'invalid' : 'ready'}:${key}`}
            label={label}
            Content={plan.issues.length ? NoProductionRoute : Content}
            skipLoading={readyTargetId === plan.targetId}
            onRevealReady={markTargetReady}
          />
        </Tab>
      ))}
    </Tabs>
  )
}
