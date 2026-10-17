import { researchScienceTypes, researchTechnologies, researchTechnologyById } from '@/shared/data'
import { Flex, Typography } from '@/shared/ui'
import { Button, Input, Select, SelectItem } from '@heroui/react'
import { Controls, ReactFlow, ReactFlowProvider, useReactFlow, useStore } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Focus, Search } from 'lucide-react'
import { type KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { RESEARCH_NODE_TYPES } from '../graph/config/node-types'
import { buildResearchGraph, findResearchTechnologyMatch, RESEARCH_NODE_SIZE } from '../graph/lib/research-graph'
import type { ResearchBranchFilter, ResearchFlowNode } from '../graph/types'
import './research-graph.css'

const BRANCH_OPTIONS: readonly { id: ResearchBranchFilter; name: string }[] = [
  { id: 'all', name: 'All research' },
  ...researchScienceTypes,
  { id: 'general', name: 'General' },
]

/** A new request also reopens the current technology after a manual tree fit. */
interface ResearchSelection {
  technologyId: string
}

interface ResearchCanvasProps {
  branch: ResearchBranchFilter
  selection?: ResearchSelection
  query: string
  onFocusTechnology: (technologyId: string) => void
  onBack: () => void
}

/**
 * Owns Research framing without changing catalog layout. Queries retain the viewport;
 * explicit Fit survives resize until a branch or technology request changes context.
 */
const ResearchCanvas = ({ branch, selection, query, onFocusTechnology, onBack }: ResearchCanvasProps) => {
  const focusedTechnologyId = selection?.technologyId
  const { fitView, setCenter, getInternalNode } = useReactFlow<ResearchFlowNode>()
  const viewMode = useRef<'detail' | 'tree'>('tree')
  const lastFrame = useRef<{ branch: ResearchBranchFilter; selection?: ResearchSelection; width: number; height: number }>(undefined)
  const width = useStore((state) => state.width)
  const height = useStore((state) => state.height)
  const graph = useMemo(
    () => buildResearchGraph({ technologies: researchTechnologies, branch, query, focusedTechnologyId }),
    [branch, focusedTechnologyId, query],
  )
  const measured = useStore((state) => {
    if (!state.panZoom || !state.width || !state.height) return false
    return graph.nodes.every((node) => {
      const current = state.nodeLookup.get(node.id)
      const expected = node.selected ? RESEARCH_NODE_SIZE.focused : RESEARCH_NODE_SIZE.compact
      // Existing nodes retain old dimensions until ResizeObserver measures the expanded card.
      // Match offsetWidth rounding and the 16px side margins in research-graph.css.
      const expectedWidth = node.selected ? Math.round(Math.min(expected.width, state.width - 32)) : expected.width
      return (
        current?.internals.userNode.data === node.data &&
        current.internals.handleBounds !== undefined &&
        current.measured.width === expectedWidth &&
        current.measured.height === expected.height
      )
    })
  })

  useEffect(() => {
    if (!measured || graph.nodes.length === 0) return
    const previous = lastFrame.current
    const newContext = previous?.branch !== branch || previous.selection !== selection
    if (!newContext && previous.width === width && previous.height === height) return
    if (newContext) viewMode.current = selection ? 'detail' : 'tree'
    lastFrame.current = { branch, selection, width, height }

    const duration = newContext && !globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 0
    const selectedNode = focusedTechnologyId ? getInternalNode(focusedTechnologyId) : undefined
    const selectedWidth = selectedNode?.measured.width
    const selectedHeight = selectedNode?.measured.height
    if (viewMode.current === 'detail' && selectedNode && selectedWidth !== undefined && selectedHeight !== undefined) {
      const { x, y } = selectedNode.internals.positionAbsolute
      void setCenter(x + selectedWidth / 2, y + selectedHeight / 2, { zoom: 1, duration })
    } else {
      void fitView({ padding: 0.12, duration })
    }
  }, [branch, fitView, focusedTechnologyId, getInternalNode, graph.nodes, height, measured, selection, setCenter, width])

  const nodeInstructions = `Press Enter or Space to open this technology at a readable scale. ${selection ? 'Press Escape to return to the overview. ' : ''}Use Tab to reach other technologies and zoom controls.`

  /** Handles only node activation and leaving detail, before React Flow's generic selection keys. */
  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && selection) {
      event.preventDefault()
      event.stopPropagation()
      onBack()
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.classList.contains('react-flow__node')) return
    const technologyId = target.dataset.id
    if (!technologyId) return
    event.preventDefault()
    event.stopPropagation()
    onFocusTechnology(technologyId)
  }

  return (
    <div className="research-canvas h-full min-h-0 min-w-0" data-flow-selection-surface onKeyDownCapture={handleCanvasKeyDown}>
      <ReactFlow<ResearchFlowNode>
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={RESEARCH_NODE_TYPES}
        onNodeClick={(event, node) => {
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true })
          onFocusTechnology(node.id)
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        deleteKeyCode={null}
        minZoom={0.01}
        maxZoom={1.6}
        colorMode="dark"
        ariaLabelConfig={{
          'node.a11yDescription.default': nodeInstructions,
          'node.a11yDescription.keyboardDisabled': nodeInstructions,
          'edge.a11yDescription.default': 'Research prerequisite connection.',
          'controls.ariaLabel': 'Research graph controls',
          'controls.fitView.ariaLabel': 'Fit research tree',
        }}
      >
        <Controls
          position="bottom-right"
          showInteractive={false}
          fitViewOptions={{ padding: 0.12, duration: 0 }}
          onFitView={() => {
            viewMode.current = 'tree'
          }}
        />
      </ReactFlow>

      <div aria-live="polite" className="pointer-events-none absolute bottom-3 left-3 rounded-sm bg-background/92 px-2.5 py-1.5">
        <Typography as="span" variant="micro" tone="soft" className="tabular-nums">
          {query.trim() ? `${graph.matchedCount} matches · ` : ''}
          {graph.visibleCount} technologies
        </Typography>
      </div>
    </div>
  )
}

/** Composes catalog search, branch filtering and in-canvas technology detail. */
export const ResearchGraph = () => {
  const [branch, setBranch] = useState<ResearchBranchFilter>('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selection, setSelection] = useState<ResearchSelection>()
  const searchRef = useRef<HTMLInputElement>(null)
  const focusedTechnology = selection ? researchTechnologyById.get(selection.technologyId) : undefined

  const handleBranchChange = (value: string) => {
    setBranch((value || 'all') as ResearchBranchFilter)
    setSelection(undefined)
  }

  /** Requests readable detail even when the technology was already selected. */
  const focusTechnology = (technologyId: string) => {
    setSelection({ technologyId })
    setQuery('')
  }

  /** Keeps keyboard focus in the toolbar when Back disappears or Escape leaves the canvas. */
  const showOverview = () => {
    setSelection(undefined)
    searchRef.current?.focus({ preventScroll: true })
  }

  /** Opens the first catalog match while keeping focus available for another search. */
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    const match = findResearchTechnologyMatch(researchTechnologies, query)
    if (!match) return
    event.preventDefault()
    focusTechnology(match.id)
  }

  return (
    <Flex direction="col" align="stretch" className="h-full min-h-0 w-full min-w-0">
      <div className="shrink-0 border-b border-divider/60 p-3">
        <Flex align="center" gap="sm" wrap="wrap">
          {focusedTechnology ? (
            <Button size="sm" variant="flat" startContent={<ArrowLeft size={16} aria-hidden />} onPress={showOverview}>
              Back to overview
            </Button>
          ) : null}
          <Select
            aria-label="Filter research by science branch"
            size="sm"
            variant="faded"
            color="primary"
            className="w-full sm:w-60"
            items={BRANCH_OPTIONS}
            selectedKeys={[branch]}
            isDisabled={Boolean(focusedTechnology)}
            onChange={(event) => handleBranchChange(event.target.value)}
          >
            {(option) => <SelectItem key={option.id}>{option.name}</SelectItem>}
          </Select>
          <Input
            ref={searchRef}
            aria-label="Search research technologies and unlocks"
            type="search"
            size="sm"
            variant="faded"
            color="primary"
            className="w-full sm:w-72"
            placeholder="Search technologies or unlocks"
            startContent={<Search size={17} aria-hidden />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <Flex align="center" gap="sm" className="ml-auto hidden text-foreground/60 xl:flex">
            <Focus size={15} aria-hidden />
            <Typography variant="small">
              {focusedTechnology ? `Showing the tree around ${focusedTechnology.name}` : 'Select a technology to open its connected tree'}
            </Typography>
          </Flex>
        </Flex>
      </div>

      <ReactFlowProvider>
        <ResearchCanvas
          branch={branch}
          selection={selection}
          query={deferredQuery}
          onFocusTechnology={focusTechnology}
          onBack={showOverview}
        />
      </ReactFlowProvider>
    </Flex>
  )
}
