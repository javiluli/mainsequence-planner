import { Tab, Tabs } from '@heroui/react'
import { Factory, ListTree, Network, Package, type LucideIcon } from 'lucide-react'
import { lazy, useCallback, useEffect, useState, type ComponentType } from 'react'

import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { PlannerDiagramReveal, type PlannerDiagramContentProps } from './diagram-reveal'
import type { ProductionPlan } from '@/features/planner/lib/production-plan/types'
import { NoProductionRoute } from './no-production-route'
import { RawTargetDiagram } from './raw-target-diagram'

const ProductionBuildingCostDiagram = lazy(() =>
  import('./production-building-cost-diagram').then((module) => ({ default: module.ProductionBuildingCostDiagram })),
)
const ProductionItemsDiagram = lazy(() =>
  import('./production-items-diagram').then((module) => ({ default: module.ProductionItemsDiagram })),
)
const ProductionTreelistDiagram = lazy(() =>
  import('./production-treelist-diagram').then((module) => ({ default: module.ProductionTreelistDiagram })),
)

const ProductionFlowDiagram = lazy(() =>
  import('./production-flow-diagram').then((module) => ({
    default: module.ProductionFlowDiagram,
  })),
)

type DiagramTab = {
  key: string
  label: string
  icon: LucideIcon
  component: ComponentType<PlannerDiagramContentProps>
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

/** Owns presentation history only for this target; replacing the keyed owner cancels obsolete callbacks. */
function TargetDiagramTabs({
  plan,
  selectedTab,
  onTabChange,
}: {
  plan: ProductionPlan
  selectedTab: string
  onTabChange: (key: string) => void
}) {
  const [hasPresentedResult, setHasPresentedResult] = useState(false)
  const markPresented = useCallback(() => setHasPresentedResult(true), [])
  useEffect(() => {
    // Raw targets have no tabs; retain the previous return-to-network behavior for the next recipe target.
    if (plan.isRawTarget) onTabChange('network-graph')
  }, [plan.isRawTarget, onTabChange])

  if (plan.isRawTarget) {
    return <PlannerDiagramReveal key={plan.targetId} label="raw material" Content={RawTargetDiagram} onPresented={markPresented} />
  }

  return (
    <Tabs
      selectedKey={selectedTab}
      onSelectionChange={(key) => onTabChange(String(key))}
      fullWidth
      placement="top"
      variant="underlined"
      color="primary"
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
            showLoading={!hasPresentedResult}
            waitForReady={!plan.issues.length && key === 'network-graph'}
            onPresented={markPresented}
            label={label}
            Content={plan.issues.length ? NoProductionRoute : Content}
          />
        </Tab>
      ))}
    </Tabs>
  )
}

/** Keeps view navigation eager while isolating the visual sequence from plan calculation and loading strategy. */
export function ProductionDiagramTabs() {
  const plan = useProductionPlan()
  // Keep tab selection outside the keyed presentation owner, so a new target does not reset the chosen view.
  const [selectedTab, setSelectedTab] = useState('network-graph')
  return plan ? (
    <TargetDiagramTabs
      key={`${plan.targetId}:${plan.issues.length ? 'invalid' : 'ready'}`}
      plan={plan}
      selectedTab={selectedTab}
      onTabChange={setSelectedTab}
    />
  ) : null
}
