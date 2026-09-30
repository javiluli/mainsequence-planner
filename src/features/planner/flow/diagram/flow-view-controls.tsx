import { Panel } from '@xyflow/react'
import { Button, ButtonGroup } from '@heroui/react'
import { Columns3, Workflow } from 'lucide-react'
import type { ProductionFlowLayout } from '../plan-to-flow'

interface FlowViewControlsProps {
  layoutMode: ProductionFlowLayout
  onLayoutChange: (layout: ProductionFlowLayout) => void
}

export function FlowViewControls({ layoutMode, onLayoutChange }: FlowViewControlsProps) {
  return (
    <Panel position="top-right" className="!m-3">
      <ButtonGroup
        aria-label="Graph layout"
        size="sm"
        variant="light"
        radius="sm"
        className="rounded-sm border border-divider bg-content1 p-1"
      >
        <Button
          aria-pressed={layoutMode === 'network'}
          onClick={() => onLayoutChange('network')}
          className={layoutMode === 'network' ? 'bg-primary/15 text-primary' : 'text-foreground/70'}
        >
          <Workflow size={14} aria-hidden />
          Network
        </Button>
        <Button
          aria-pressed={layoutMode === 'stages'}
          onClick={() => onLayoutChange('stages')}
          className={layoutMode === 'stages' ? 'bg-primary/15 text-primary' : 'text-foreground/70'}
        >
          <Columns3 size={14} aria-hidden />
          Stages
        </Button>
      </ButtonGroup>
    </Panel>
  )
}
