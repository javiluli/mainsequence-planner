import { researchTechnologies } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import {
  buildResearchGraph,
  collectFocusedTechnologyIds,
  findResearchTechnologyMatch,
  getResearchPrerequisiteIds,
  RESEARCH_NODE_SIZE,
} from '@/features/research/graph/lib/research-graph'

describe('research graph', () => {
  it('renders every unique technology and every source prerequisite in the complete graph', () => {
    const graph = buildResearchGraph({ technologies: researchTechnologies, branch: 'all' })
    const expectedEdgeCount = researchTechnologies.reduce((count, technology) => count + getResearchPrerequisiteIds(technology).length, 0)

    expect(graph.nodes).toHaveLength(97)
    expect(graph.edges).toHaveLength(expectedEdgeCount)
    expect(graph.edges.every((edge) => edge.type === 'default' && edge.pathOptions?.curvature === 0.35)).toBe(true)
    expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(graph.nodes.length)
    expect(graph.nodes.every((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true)
    expect(new Set(graph.nodes.map((node) => `${node.position.x}:${node.position.y}`)).size).toBe(graph.nodes.length)
  })

  it('keeps the complete graph compact without inventing links for independent technologies', () => {
    const graph = buildResearchGraph({ technologies: researchTechnologies, branch: 'all' })
    const degrees = new Map(graph.nodes.map((node) => [node.id, 0]))
    for (const edge of graph.edges) {
      degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1)
      degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
    }
    const width =
      Math.max(...graph.nodes.map((node) => node.position.x + RESEARCH_NODE_SIZE.compact.width)) -
      Math.min(...graph.nodes.map((node) => node.position.x))

    expect([...degrees.values()].filter((degree) => degree === 0)).toHaveLength(15)
    expect(graph.nodes.filter((node) => node.data.independent)).toHaveLength(15)
    expect(graph.nodes.find((node) => node.id === 'RSC_Plants1')?.data.independent).toBe(true)
    expect(graph.nodes.find((node) => node.id === 'RSC_WarpDrive')?.data.independent).toBe(false)
    expect(width).toBeLessThan(5600)
  })

  it.each(['all', 'alien_technology'] as const)('leaves visible connection lanes throughout the %s research overview', (branch) => {
    const graph = buildResearchGraph({ technologies: researchTechnologies, branch })
    const columns = new Map<number, typeof graph.nodes>()

    for (const node of graph.nodes) {
      const rank = Math.round(node.position.x + RESEARCH_NODE_SIZE.compact.width / 2)
      const column = columns.get(rank) ?? []
      column.push(node)
      columns.set(rank, column)
    }

    const orderedColumns = [...columns].sort(([first], [second]) => first - second)
    for (let index = 1; index < orderedColumns.length; index += 1) {
      const previousRight = Math.max(...orderedColumns[index - 1][1].map((node) => node.position.x + RESEARCH_NODE_SIZE.compact.width))
      const currentLeft = Math.min(...orderedColumns[index][1].map((node) => node.position.x))
      expect(currentLeft - previousRight).toBeGreaterThanOrEqual(40)
    }

    for (const column of columns.values()) {
      const ordered = column.sort((first, second) => first.position.y - second.position.y)
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index].position.y - ordered[index - 1].position.y - RESEARCH_NODE_SIZE.compact.height).toBeGreaterThanOrEqual(24)
      }
    }
  })

  it('keeps prerequisite ancestors as context when filtering a science branch', () => {
    const graph = buildResearchGraph({ technologies: researchTechnologies, branch: 'alien_technology' })
    const relicSynthesis = graph.nodes.find((node) => node.id === 'RSC_RelicSynthesis')
    const superconductorCoil = graph.nodes.find((node) => node.id === 'RSC_SupercondutorCoil')

    expect(relicSynthesis?.data.contextual).toBe(false)
    expect(superconductorCoil?.data.contextual).toBe(true)
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'RSC_SupercondutorCoil', target: 'RSC_RelicSynthesis' }))
  })

  it('opens the selected technology with its complete ancestry and a local forward tree', () => {
    const focusedIds = collectFocusedTechnologyIds(researchTechnologies, 'RSC_WarpDrive')
    const graph = buildResearchGraph({
      technologies: researchTechnologies,
      branch: 'all',
      focusedTechnologyId: 'RSC_WarpDrive',
    })

    expect(focusedIds.size).toBe(19)
    expect(focusedIds.has('RSC_Shipyard1')).toBe(true)
    expect(focusedIds.has('RSC_EnrichmentChamber')).toBe(true)
    expect(focusedIds.has('RSC_CobaltRefining')).toBe(true)
    expect(focusedIds.has('RSC_GraphiteRefining')).toBe(true)
    expect(focusedIds.has('RSC_OreEnrichment')).toBe(true)
    expect(focusedIds.has('RSC_Superalloy')).toBe(true)
    expect(focusedIds.has('RSC_CaptainQuarters')).toBe(false)
    expect(graph.nodes.find((node) => node.id === 'RSC_WarpDrive')?.selected).toBe(true)
  })

  it.each([
    ['RSC_Logistics1', 22],
    ['RSC_WarpDrive', 19],
  ] as const)('centers and spaces the %s tree without overlapping nodes or losing prerequisites', (focusedTechnologyId, visibleCount) => {
    const graph = buildResearchGraph({
      technologies: researchTechnologies,
      branch: 'all',
      focusedTechnologyId,
    })
    const columns = new Map<number, typeof graph.nodes>()

    for (const node of graph.nodes) {
      const size = node.selected ? RESEARCH_NODE_SIZE.focused : RESEARCH_NODE_SIZE.compact
      const rank = Math.round(node.position.x + size.width / 2)
      const column = columns.get(rank) ?? []
      column.push(node)
      columns.set(rank, column)
    }

    expect(graph.nodes).toHaveLength(visibleCount)
    expect(
      graph.edges.every(
        (edge) => graph.nodes.some((node) => node.id === edge.source) && graph.nodes.some((node) => node.id === edge.target),
      ),
    ).toBe(true)
    expect(graph.nodes.find((node) => node.id === focusedTechnologyId)?.position.y).toBe(-RESEARCH_NODE_SIZE.focused.height / 2)

    const orderedColumns = [...columns].sort(([first], [second]) => first - second)
    for (let index = 1; index < orderedColumns.length; index += 1) {
      const previous = orderedColumns[index - 1][1]
      const current = orderedColumns[index][1]
      const previousRight = Math.max(
        ...previous.map((node) => node.position.x + (node.selected ? RESEARCH_NODE_SIZE.focused.width : RESEARCH_NODE_SIZE.compact.width)),
      )
      const currentLeft = Math.min(...current.map((node) => node.position.x))
      expect(currentLeft - previousRight).toBeGreaterThanOrEqual(100)
    }

    for (const column of columns.values()) {
      const ordered = column.sort((first, second) => first.position.y - second.position.y)
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1]
        const previousHeight = previous.selected ? RESEARCH_NODE_SIZE.focused.height : RESEARCH_NODE_SIZE.compact.height
        expect(ordered[index].position.y - previous.position.y - previousHeight).toBeGreaterThanOrEqual(32)
      }
    }
  })

  it('preserves the game’s primary and additional prerequisite relationships', () => {
    const logistics2 = researchTechnologies.find((technology) => technology.id === 'RSC_Logistics2')!
    const warpDrive = researchTechnologies.find((technology) => technology.id === 'RSC_WarpDrive')!

    expect(logistics2.primary_prerequisite).toBe('RSC_ComputationScience')
    expect(logistics2.prerequisites).toEqual(['RSC_Servomotors'])
    expect(warpDrive.primary_prerequisite).toBe('RSC_Shipyard1')
    expect(warpDrive.prerequisites).toEqual(['RSC_EnrichmentChamber'])

    const graph = buildResearchGraph({ technologies: researchTechnologies, branch: 'all', focusedTechnologyId: 'RSC_Logistics2' })
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'RSC_ComputationScience', target: 'RSC_Logistics2' }))
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'RSC_Servomotors', target: 'RSC_Logistics2' }))
  })

  it('keeps the photographed local trees without expanding distant descendants', () => {
    const logistics = collectFocusedTechnologyIds(researchTechnologies, 'RSC_Logistics1')
    const silica = collectFocusedTechnologyIds(researchTechnologies, 'RSC_SilicaRefining')
    const shipyard = collectFocusedTechnologyIds(researchTechnologies, 'RSC_Shipyard1')
    const relics = collectFocusedTechnologyIds(researchTechnologies, 'RSC_RelicAnalyzer')

    expect(logistics).toContain('RSC_CobaltRefining')
    expect(logistics).toContain('RSC_SolarPanels3')
    expect(logistics.has('RSC_OreEnrichment')).toBe(false)
    expect(silica).toContain('RSC_WarpDrive')
    expect(silica.has('RSC_CobaltRefining')).toBe(false)
    expect(shipyard).toContain('RSC_Superalloy')
    expect(shipyard).toContain('RSC_SolarPanels2')
    expect(shipyard.has('RSC_Shipyard2')).toBe(false)
    expect(relics).toEqual(
      new Set(['RSC_RelicAnalyzer', 'RSC_RelicCapacitor', 'RSC_RelicSynthesis', 'RSC_RelicThruster_01', 'RSC_BasicOreSynthesis']),
    )
  })

  it('builds every local tree from valid references without overlapping cards', () => {
    const sourceIds = new Set(researchTechnologies.map((technology) => technology.id))

    for (const technology of researchTechnologies) {
      for (const prerequisiteId of getResearchPrerequisiteIds(technology)) {
        expect(sourceIds.has(prerequisiteId), `${technology.id} -> ${prerequisiteId}`).toBe(true)
      }

      const graph = buildResearchGraph({ technologies: researchTechnologies, branch: 'all', focusedTechnologyId: technology.id })
      const visibleIds = new Set(graph.nodes.map((node) => node.id))
      expect(visibleIds.has(technology.id)).toBe(true)
      expect(graph.edges.every((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))).toBe(true)

      const rectangles = graph.nodes.map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.selected ? RESEARCH_NODE_SIZE.focused.width : RESEARCH_NODE_SIZE.compact.width,
        height: node.selected ? RESEARCH_NODE_SIZE.focused.height : RESEARCH_NODE_SIZE.compact.height,
      }))
      for (let first = 0; first < rectangles.length; first += 1) {
        for (let second = first + 1; second < rectangles.length; second += 1) {
          const a = rectangles[first]
          const b = rectangles[second]
          const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
          expect(overlaps, `${technology.id}: ${a.id} overlaps ${b.id}`).toBe(false)
        }
      }
    }
  })

  it('searches technology and reward display data without removing graph context', () => {
    const graph = buildResearchGraph({ technologies: researchTechnologies, branch: 'all', query: 'Titanium Ore' })

    expect(graph.visibleCount).toBe(97)
    expect(graph.matchedCount).toBeGreaterThan(0)
    expect(graph.matchedCount).toBeLessThan(graph.visibleCount)
    expect(graph.nodes.some((node) => !node.data.dimmed && node.id === 'RSC_BasicOreSynthesis')).toBe(true)
    expect(findResearchTechnologyMatch(researchTechnologies, 'Slipstream Drive')?.id).toBe('RSC_WarpDrive')
    expect(findResearchTechnologyMatch(researchTechnologies, 'Titanium Ore')?.id).toBe('RSC_BasicOreSynthesis')
  })
})
