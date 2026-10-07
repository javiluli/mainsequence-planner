import { researchScienceTypes, researchTechnologies, researchTechnologyById } from '@/shared/data'
import { Flex, Typography } from '@/shared/ui'
import { Button, Input, Select, SelectItem } from '@heroui/react'
import { Controls, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Focus, Search } from 'lucide-react'
import { type KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { RESEARCH_NODE_TYPES } from '../graph/config/node-types'
import { buildResearchGraph, findResearchTechnologyMatch } from '../graph/lib/research-graph'
import type { ResearchBranchFilter, ResearchFlowNode } from '../graph/types'
import './research-graph.css'

const BRANCH_OPTIONS: readonly { id: ResearchBranchFilter; name: string }[] = [
  { id: 'all', name: 'All research' },
  ...researchScienceTypes,
  { id: 'general', name: 'General' },
]

interface ResearchCanvasProps {
  branch: ResearchBranchFilter
  focusedTechnologyId?: string
  query: string
  onFocusTechnology: (technologyId: string) => void
}

const ResearchCanvas = ({ branch, focusedTechnologyId, query, onFocusTechnology }: ResearchCanvasProps) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const { fitView } = useReactFlow<ResearchFlowNode>()
  const graph = useMemo(
    () => buildResearchGraph({ technologies: researchTechnologies, branch, query, focusedTechnologyId }),
    [branch, focusedTechnologyId, query],
  )
  useEffect(() => {
    const moveToContent = (duration: number) =>
      fitView({
        padding: focusedTechnologyId ? 0.1 : 0.12,
        duration: globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration,
      })

    const timeoutId = globalThis.setTimeout(() => moveToContent(focusedTechnologyId ? 500 : 350), 50)
    const canvas = canvasRef.current
    if (!canvas) return () => globalThis.clearTimeout(timeoutId)

    let previousWidth = canvas.clientWidth
    let previousHeight = canvas.clientHeight
    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      if (width === previousWidth && height === previousHeight) return
      previousWidth = width
      previousHeight = height
      globalThis.requestAnimationFrame(() => moveToContent(0))
    })
    resizeObserver.observe(canvas)

    return () => {
      globalThis.clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [branch, fitView, focusedTechnologyId])

  return (
    <div
      ref={canvasRef}
      className="research-canvas h-full min-h-0 min-w-0"
      data-flow-selection-surface
      onKeyDownCapture={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        const target = event.target
        if (!(target instanceof HTMLElement) || !target.classList.contains('react-flow__node')) return
        const technologyId = target.dataset.id
        if (!technologyId) return
        event.preventDefault()
        event.stopPropagation()
        onFocusTechnology(technologyId)
      }}
    >
      <ReactFlow<ResearchFlowNode>
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={RESEARCH_NODE_TYPES}
        onNodeClick={(_, node) => onFocusTechnology(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.12}
        maxZoom={1.6}
        colorMode="dark"
        fitView
      >
        <Controls position="bottom-right" showInteractive={false} />
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

export const ResearchGraph = () => {
  const [branch, setBranch] = useState<ResearchBranchFilter>('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [focusedTechnologyId, setFocusedTechnologyId] = useState<string>()
  const focusedTechnology = focusedTechnologyId ? researchTechnologyById.get(focusedTechnologyId) : undefined

  const handleBranchChange = (value: string) => {
    setBranch((value || 'all') as ResearchBranchFilter)
    setFocusedTechnologyId(undefined)
  }

  const focusTechnology = (technologyId: string) => {
    setFocusedTechnologyId(technologyId)
    setQuery('')
  }

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
            <Button
              size="sm"
              variant="bordered"
              startContent={<ArrowLeft size={16} aria-hidden />}
              onPress={() => setFocusedTechnologyId(undefined)}
            >
              Back to overview
            </Button>
          ) : null}
          <Select
            aria-label="Filter research by science branch"
            size="sm"
            variant="bordered"
            className="w-full sm:w-60"
            items={BRANCH_OPTIONS}
            selectedKeys={[branch]}
            isDisabled={Boolean(focusedTechnology)}
            onChange={(event) => handleBranchChange(event.target.value)}
          >
            {(option) => <SelectItem key={option.id}>{option.name}</SelectItem>}
          </Select>
          <Input
            aria-label="Search research technologies and unlocks"
            type="search"
            size="sm"
            variant="bordered"
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
          focusedTechnologyId={focusedTechnologyId}
          query={deferredQuery}
          onFocusTechnology={focusTechnology}
        />
      </ReactFlowProvider>
    </Flex>
  )
}
