import { Panel } from '@xyflow/react'
import { Columns3, Workflow } from 'lucide-react'
import type { ProductionFlowLayout } from '../plan-to-flow'

interface FlowViewControlsProps {
  layoutMode: ProductionFlowLayout
  onLayoutChange: (layout: ProductionFlowLayout) => void
}

export function FlowViewControls({ layoutMode, onLayoutChange }: FlowViewControlsProps) {
  return (
    <Panel position="top-right" className="!m-3">
      <div
        role="group"
        aria-label="Graph layout"
        className="flex gap-0.5 rounded-sm border border-divider bg-content1 p-1 shadow-md shadow-black/20"
      >
        <button
          type="button"
          aria-pressed={layoutMode === 'network'}
          onClick={() => onLayoutChange('network')}
          className="flex min-h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-default/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-pressed:bg-primary/15 aria-pressed:text-primary"
        >
          <Workflow size={14} aria-hidden />
          Network
        </button>
        <button
          type="button"
          aria-pressed={layoutMode === 'stages'}
          onClick={() => onLayoutChange('stages')}
          className="flex min-h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-default/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-pressed:bg-primary/15 aria-pressed:text-primary"
        >
          <Columns3 size={14} aria-hidden />
          Stages
        </button>
      </div>
    </Panel>
  )
}
