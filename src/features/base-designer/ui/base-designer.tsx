import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Tooltip } from '@heroui/react'
import { Background, BackgroundVariant, Controls, ReactFlow, type ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Box, ClipboardPaste, Copy, Eraser, Factory, Hand, Plus, Redo2, RotateCw, Trash2, Undo2, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import { buildings } from '@/shared/data'
import { CELL_SIZE, PLACEABLES, STATION_TYPES, isRouteTool, type EditorTool, type Direction, type StationType } from '../model/catalog'
import { canPlace, indexPlacements, type BasePlacement, type BaseStation } from '../lib/placement'
import { connectedProductionBelts } from '../lib/connections'
import { canCrossStationBoundary, connectedCorridors } from '../lib/stations'
import { canPlaceRouteInLayout, neighboringPlacements, worldPlacements } from '../lib/world-layout'
import { routeCells, type RouteAnchor, type RouteDraft } from '../lib/route'
import { StationNode, type StationFlowNode } from './station-node'
import { BuildPaletteModal } from './build-palette-modal'
import './base-designer.css'

const nodeTypes = { station: StationNode }
const stationSnapGrid: [number, number] = [CELL_SIZE, CELL_SIZE]
const directionSteps: Record<Direction, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
}

type LayoutClipboard = { kind: 'station'; source: BaseStation } | { kind: 'placements'; source: BasePlacement[] }
interface SelectedPart {
  stationId: string
  placementId: string
}

const powerBuildingIds: Partial<Record<keyof typeof PLACEABLES, string>> = {
  refinery: 'refinery',
  assembler: 'fabricator',
  enrichment: 'enrichment',
}
const powerByBuildingId = new Map(buildings.map((building) => [building.id, building.power]))

export function BaseDesigner() {
  const stations = useBaseDesignerStore((state) => state.stations)
  const addStation = useBaseDesignerStore((state) => state.addStation)
  const moveStation = useBaseDesignerStore((state) => state.moveStation)
  const toggleStationLock = useBaseDesignerStore((state) => state.toggleStationLock)
  const removeStation = useBaseDesignerStore((state) => state.removeStation)
  const cloneStation = useBaseDesignerStore((state) => state.cloneStation)
  const pastePlacements = useBaseDesignerStore((state) => state.pastePlacements)
  const undo = useBaseDesignerStore((state) => state.undo)
  const redo = useBaseDesignerStore((state) => state.redo)
  const canUndo = useBaseDesignerStore((state) => state.past.length > 0)
  const canRedo = useBaseDesignerStore((state) => state.future.length > 0)
  const place = useBaseDesignerStore((state) => state.place)
  const placeRoute = useBaseDesignerStore((state) => state.placeRoute)
  const movePlacement = useBaseDesignerStore((state) => state.movePlacement)
  const moveRoute = useBaseDesignerStore((state) => state.moveRoute)
  const rotateAt = useBaseDesignerStore((state) => state.rotateAt)
  const removeAt = useBaseDesignerStore((state) => state.removeAt)
  const [tool, setTool] = useState<EditorTool>('select')
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null)
  const [clipboard, setClipboard] = useState<LayoutClipboard | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [flow, setFlow] = useState<ReactFlowInstance<StationFlowNode> | null>(null)
  const activeStation = stations.find((station) => station.id === activeStationId)
  const selectedStation = selectedPart && stations.find((station) => station.id === selectedPart.stationId)
  const selectedPlacement = selectedStation?.placements.find((piece) => piece.id === selectedPart?.placementId)
  const machines = stations.flatMap((station) => station.placements).filter((piece) => PLACEABLES[piece.type].category === 'machine')
  const knownEnergyUse = machines.reduce((sum, piece) => sum + (powerByBuildingId.get(powerBuildingIds[piece.type] ?? '') ?? 0), 0)
  const unknownEnergyUse = machines.filter((piece) => powerByBuildingId.get(powerBuildingIds[piece.type] ?? '') === undefined).length
  const reactors = machines.filter((piece) => piece.type === 'reactor').length
  const requiredEnergyLabel = unknownEnergyUse
    ? knownEnergyUse > 0
      ? `≥${knownEnergyUse.toFixed(1)} MJ`
      : '— MJ'
    : `${knownEnergyUse.toFixed(1)} MJ`
  const worldPieces = useMemo(() => worldPlacements(stations), [stations])
  const worldOccupied = useMemo(() => indexPlacements(worldPieces), [worldPieces])
  const corridors = useMemo(() => connectedCorridors(stations), [stations])
  const animatedBelts = useMemo(
    () =>
      connectedProductionBelts(worldPieces, worldOccupied, (x, y, face) => {
        const [dx, dy] = directionSteps[face]
        return canCrossStationBoundary(stations, { x, y }, { x: x + dx, y: y + dy }, corridors)
      }),
    [worldPieces, worldOccupied, stations, corridors],
  )
  const activeToolLabel = tool === 'select' ? 'Drag a station or select a part' : tool === 'erase' ? 'Erase' : PLACEABLES[tool].label

  const selectTool = useCallback((next: EditorTool) => {
    setTool(next)
    setRouteDraft(null)
    setNotice(null)
  }, [])

  useEffect(() => {
    if (!flow || stations.length === 0) return
    const fit = () => requestAnimationFrame(() => void flow.fitView({ maxZoom: 1.15, padding: 0.2 }))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [flow, stations.length])

  const handleCell = useCallback(
    (
      stationId: string,
      x: number,
      y: number,
      direction?: Direction,
      portFace?: Direction,
      portRole?: 'input' | 'output',
      portRouteId?: string,
    ) => {
      const station = stations.find((candidate) => candidate.id === stationId)
      if (isRouteTool(tool)) {
        if (!station) return
        const worldX = station.position.x / CELL_SIZE + x
        const worldY = station.position.y / CELL_SIZE + y
        const point: RouteAnchor = portFace
          ? { kind: 'port', x: worldX, y: worldY, face: portFace, role: portRole, routeId: portRouteId }
          : { kind: 'floor', x: worldX, y: worldY }
        if (!routeDraft || routeDraft.type !== tool) {
          if (point.kind === 'port' && point.role === 'input') {
            setNotice('Start from an output, or from an empty floor cell.')
            return
          }
          if (!canPlaceRouteInLayout(stations, stationId, routeCells([point]))) {
            setNotice('Start on an empty floor cell or a port with free space in front of it.')
            return
          }
          setRouteDraft({ stationId, type: tool, anchors: [point], hover: point })
          setNotice('Click to add anchors, click a machine port to connect, or click the last anchor again to finish.')
          return
        }
        const last = routeDraft.anchors[routeDraft.anchors.length - 1]
        if (point.kind === 'port') {
          if (point.role === 'output') {
            setNotice('Finish at an input, or on an empty floor cell.')
            return
          }
          if (last.kind === 'port' && last.x === worldX && last.y === worldY && last.face === point.face) {
            setNotice('Choose another port or floor cell to continue this belt.')
            return
          }
          const cells = routeCells([...routeDraft.anchors, point])
          const mergeIds = [routeDraft.anchors[0], point]
            .filter((anchor): anchor is Extract<RouteAnchor, { kind: 'port' }> => anchor.kind === 'port')
            .flatMap((anchor) => (anchor.routeId ? [anchor.routeId] : []))
          if (placeRoute(routeDraft.stationId, tool, cells, mergeIds)) {
            setRouteDraft(null)
            setNotice(null)
          } else {
            setNotice('This connection crosses a wall or occupied cell, or cannot turn into the selected port.')
          }
          return
        }
        if (last.x === worldX && last.y === worldY) {
          const cells = routeCells(routeDraft.anchors)
          const start = routeDraft.anchors[0]
          if (placeRoute(routeDraft.stationId, tool, cells, start.kind === 'port' && start.routeId ? [start.routeId] : [])) {
            setRouteDraft(null)
            setNotice(null)
          } else {
            setNotice('This route crosses a wall or occupied cell. Move an anchor before confirming.')
          }
          return
        }
        const anchors = [...routeDraft.anchors, point]
        if (!canPlaceRouteInLayout(stations, routeDraft.stationId, routeCells(anchors))) {
          setNotice('This segment crosses a wall or occupied cell. Choose another anchor.')
          return
        }
        setRouteDraft({ ...routeDraft, anchors, hover: point })
        setNotice('Anchor added. Click another point, or click this anchor again to finish.')
      } else if (tool === 'select') {
        const placed = station && worldOccupied.get(`${station.position.x / CELL_SIZE + x},${station.position.y / CELL_SIZE + y}`)
        const owner = placed && stations.find((candidate) => candidate.id === placed.stationId)
        setSelectedPart(placed ? { stationId: placed.stationId, placementId: placed.id } : null)
        const routeLength = placed?.routeId ? worldPieces.filter((piece) => piece.routeId === placed.routeId).length : 0
        setNotice(
          placed?.routeId
            ? `${PLACEABLES[placed.type].label} route · ${routeLength} cells. Drag to move the whole route.`
            : placed
              ? `${PLACEABLES[placed.type].label} · cell ${placed.x - (owner?.position.x ?? station.position.x) / CELL_SIZE + 1}, ${placed.y - (owner?.position.y ?? station.position.y) / CELL_SIZE + 1}`
              : `Empty cell ${x + 1}, ${y + 1}`,
        )
      } else if (tool === 'erase') {
        const placed = station && worldOccupied.get(`${station.position.x / CELL_SIZE + x},${station.position.y / CELL_SIZE + y}`)
        const owner = placed && stations.find((candidate) => candidate.id === placed.stationId)
        if (placed && owner) removeAt(owner.id, placed.x - owner.position.x / CELL_SIZE, placed.y - owner.position.y / CELL_SIZE)
        setSelectedPart(null)
        setNotice(null)
      } else if (place(stationId, tool, x, y, direction)) {
        setNotice(null)
      } else {
        setNotice('No space here. Choose an empty area inside the station.')
      }
    },
    [tool, stations, worldOccupied, worldPieces, routeDraft, place, placeRoute, removeAt],
  )

  const handleRouteHover = useCallback(
    (stationId: string, anchor: RouteAnchor) => {
      const station = stations.find((candidate) => candidate.id === stationId)
      if (!station) return
      const hover = { ...anchor, x: anchor.x + station.position.x / CELL_SIZE, y: anchor.y + station.position.y / CELL_SIZE }
      setRouteDraft((draft) => {
        if (!draft || draft.type !== tool) return draft
        const previous = draft.hover
        if (
          previous?.x === hover.x &&
          previous.y === hover.y &&
          previous.kind === hover.kind &&
          (previous.kind !== 'port' || (hover.kind === 'port' && previous.face === hover.face))
        )
          return draft
        return { ...draft, hover }
      })
    },
    [stations, tool],
  )

  const handleMovePlacement = useCallback(
    (stationId: string, placementId: string, x: number, y: number) => {
      if (!movePlacement(stationId, placementId, x, y)) return false
      const owner = useBaseDesignerStore.getState().stations.find((station) => station.placements.some((piece) => piece.id === placementId))
      if (owner) {
        setActiveStationId(owner.id)
        setSelectedPart({ stationId: owner.id, placementId })
      }
      setNotice(null)
      return true
    },
    [movePlacement],
  )

  const nodes = useMemo<StationFlowNode[]>(
    () =>
      stations.map((station) => ({
        id: station.id,
        type: 'station',
        position: station.position,
        data: {
          station,
          layoutStations: stations,
          externalPlacements: neighboringPlacements(station, corridors, worldPieces),
          animatedBelts,
          tool,
          active: station.id === activeStationId,
          selectedPlacementId: selectedPart?.stationId === station.id ? selectedPart.placementId : null,
          selectedRouteId: selectedPlacement?.routeId ?? null,
          onActivate: setActiveStationId,
          onCell: handleCell,
          onPickTool: selectTool,
          onRouteHover: handleRouteHover,
          onMovePlacement: handleMovePlacement,
          onMoveRoute: moveRoute,
          onToggleStationLock: toggleStationLock,
          onReleaseTool: () => selectTool('select'),
          routeDraft,
        },
        draggable: true,
        selectable: true,
        zIndex: station.placements.some((piece) => {
          const footprint = PLACEABLES[piece.type]
          const size = STATION_TYPES[station.type].footprintCells
          return piece.x < 0 || piece.y < 0 || piece.x + footprint.width > size || piece.y + footprint.height > size
        })
          ? 2
          : 0,
      })),
    [
      stations,
      corridors,
      worldPieces,
      animatedBelts,
      tool,
      activeStationId,
      selectedPart,
      selectedPlacement,
      handleCell,
      handleRouteHover,
      handleMovePlacement,
      moveRoute,
      toggleStationLock,
      routeDraft,
      selectTool,
    ],
  )

  const add = (type: StationType) => {
    addStation(type)
    setNotice(null)
  }

  const copySelection = useCallback(() => {
    if (selectedPlacement && selectedStation) {
      const source = selectedPlacement.routeId
        ? worldPieces
            .filter((piece) => piece.routeId === selectedPlacement.routeId)
            .map((piece) => ({
              ...piece,
              x: piece.x - selectedStation.position.x / CELL_SIZE,
              y: piece.y - selectedStation.position.y / CELL_SIZE,
            }))
        : [selectedPlacement]
      setClipboard({ kind: 'placements', source })
      setNotice(`${source.length > 1 ? 'Route' : PLACEABLES[selectedPlacement.type].label} copied.`)
    } else if (activeStation) {
      setClipboard({ kind: 'station', source: activeStation })
      setNotice(`${activeStation.name} copied.`)
    }
  }, [selectedPlacement, selectedStation, activeStation, worldPieces])

  const pasteSelection = useCallback(() => {
    if (!clipboard) return
    if (clipboard.kind === 'station') {
      const id = cloneStation(clipboard.source)
      setActiveStationId(id)
      setSelectedPart(null)
      const shared = clipboard.source.placements.some(
        (piece) => !canPlace({ ...clipboard.source, placements: [] }, piece.type, piece.x, piece.y),
      )
      setNotice(shared ? 'Station copied. Parts spanning another station were not copied.' : 'Station copied to the canvas.')
      return
    }
    const stationId = activeStationId ?? selectedPart?.stationId
    if (!stationId) {
      setNotice('Select a station to paste into.')
      return
    }
    const id = pastePlacements(stationId, clipboard.source)
    if (id) {
      setSelectedPart({ stationId, placementId: id })
      setNotice('Placed a copy on the nearest free floor.')
    } else {
      setNotice('No free footprint for this copy in the selected station.')
    }
  }, [clipboard, cloneStation, pastePlacements, activeStationId, selectedPart])

  const deleteSelection = useCallback(() => {
    if (selectedPlacement && selectedPart) {
      removeAt(selectedPart.stationId, selectedPlacement.x, selectedPlacement.y)
      setSelectedPart(null)
      setNotice(null)
    } else if (activeStationId) {
      setDeleteOpen(true)
    }
  }, [selectedPlacement, selectedPart, activeStationId, removeAt])

  const rotateSelection = useCallback(() => {
    if (!selectedPlacement || !selectedPart) return
    if (selectedPlacement.routeId) {
      setNotice('Redraw a belt route to change its turns.')
      return
    }
    rotateAt(selectedPart.stationId, selectedPlacement.x, selectedPlacement.y)
  }, [selectedPlacement, selectedPart, rotateAt])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        paletteOpen ||
        deleteOpen ||
        (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"], [role="dialog"]'))
      )
        return
      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        setSelectedPart(null)
      } else if (command && key === 'y') {
        event.preventDefault()
        redo()
        setSelectedPart(null)
      } else if (command && key === 'c') {
        event.preventDefault()
        copySelection()
      } else if (command && key === 'v') {
        event.preventDefault()
        pasteSelection()
      } else if (command && key === 'x') {
        event.preventDefault()
        copySelection()
        deleteSelection()
      } else if (!command && (key === 'delete' || key === 'backspace')) {
        event.preventDefault()
        deleteSelection()
      } else if (!command && key === 'r' && selectedPart) {
        event.preventDefault()
        rotateSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paletteOpen, deleteOpen, selectedPart, copySelection, pasteSelection, deleteSelection, rotateSelection, undo, redo])

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-divider bg-content1 px-3 py-2 sm:px-4">
          <Button
            size="sm"
            color="primary"
            className="rounded-sm"
            onPress={() => setPaletteOpen(true)}
            startContent={<Plus size={14} aria-hidden />}
          >
            Build
          </Button>
          <Button
            size="sm"
            variant={tool === 'select' ? 'solid' : 'flat'}
            color={tool === 'select' ? 'primary' : 'default'}
            onPress={() => selectTool('select')}
            startContent={<Hand size={14} />}
            aria-pressed={tool === 'select'}
          >
            Select
          </Button>
          <Button
            size="sm"
            variant={tool === 'erase' ? 'solid' : 'flat'}
            color={tool === 'erase' ? 'primary' : 'default'}
            onPress={() => selectTool('erase')}
            startContent={<Eraser size={14} />}
            aria-pressed={tool === 'erase'}
          >
            Erase
          </Button>
          <span className="text-xs text-foreground/60">{activeToolLabel}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-foreground/55 sm:inline">{activeStation?.name ?? `${stations.length} stations`}</span>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <ReactFlow<StationFlowNode>
            nodes={nodes}
            edges={[]}
            onInit={setFlow}
            nodeTypes={nodeTypes}
            onNodeDragStart={() => useBaseDesignerStore.getState().beginMoveStation()}
            onNodeDrag={(_, node) => moveStation(node.id, node.position)}
            onNodeDragStop={(_, node) => {
              moveStation(node.id, node.position)
              useBaseDesignerStore.getState().endMoveStation()
            }}
            snapToGrid
            snapGrid={stationSnapGrid}
            onNodeClick={(_, node) => setActiveStationId(node.id)}
            onPaneClick={() => {
              setActiveStationId(null)
              setSelectedPart(null)
            }}
            onPaneContextMenu={(event) => {
              event.preventDefault()
              selectTool('select')
            }}
            defaultViewport={{ x: 120, y: 100, zoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            colorMode="dark"
            deleteKeyCode={null}
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Lines} gap={CELL_SIZE} color="hsl(var(--heroui-default-300) / 0.25)" />
            <Controls position="bottom-right" showInteractive={false} className="!border-divider !bg-content1" />
          </ReactFlow>
          <div className="pointer-events-none absolute top-3 right-3 left-3 z-10 flex flex-wrap items-start gap-2">
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span
                className="border border-divider bg-content1/95 px-2.5 py-1.5 tabular-nums"
                title="Placed production and support machines"
              >
                <Factory size={13} aria-hidden className="mr-1.5 inline text-primary" />
                {machines.length} buildings
              </span>
              <span
                className="border border-divider bg-content1/95 px-2.5 py-1.5 tabular-nums"
                title={
                  unknownEnergyUse
                    ? `${unknownEnergyUse} placed structures have no power-use value in the source catalog; the displayed figure includes only known values.`
                    : 'Known required energy'
                }
              >
                <Zap size={13} aria-hidden className="mr-1.5 inline text-warning" />
                Required {requiredEnergyLabel}
              </span>
              <span
                className="border border-divider bg-content1/95 px-2.5 py-1.5 tabular-nums"
                title={reactors ? 'Reactor generation is not present in the current game catalog' : 'No generators placed'}
              >
                Produced {reactors ? '— MJ' : '0 MJ'}
              </span>
            </div>
            <div className="nodrag nopan pointer-events-auto ml-auto flex flex-wrap gap-1 rounded-sm border border-divider bg-content1/95 p-1">
              <Tooltip content="Undo · Ctrl+Z">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Undo"
                  isDisabled={!canUndo}
                  onPress={() => {
                    undo()
                    setSelectedPart(null)
                  }}
                >
                  <Undo2 size={16} />
                </Button>
              </Tooltip>
              <Tooltip content="Redo · Ctrl+Y">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Redo"
                  isDisabled={!canRedo}
                  onPress={() => {
                    redo()
                    setSelectedPart(null)
                  }}
                >
                  <Redo2 size={16} />
                </Button>
              </Tooltip>
              <span className="mx-0.5 w-px bg-divider" aria-hidden />
              <Tooltip content="Copy · Ctrl+C">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Copy selected element"
                  isDisabled={!selectedPlacement && !activeStation}
                  onPress={copySelection}
                >
                  <Copy size={16} />
                </Button>
              </Tooltip>
              <Tooltip content="Paste · Ctrl+V">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Paste copied element"
                  isDisabled={!clipboard}
                  onPress={pasteSelection}
                >
                  <ClipboardPaste size={16} />
                </Button>
              </Tooltip>
              <Tooltip content="Rotate · R">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Rotate selected element"
                  isDisabled={!selectedPlacement || Boolean(selectedPlacement.routeId)}
                  onPress={rotateSelection}
                >
                  <RotateCw size={16} />
                </Button>
              </Tooltip>
              <Tooltip content="Delete · Del">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  aria-label="Delete selected element"
                  isDisabled={!selectedPlacement && !activeStation}
                  onPress={deleteSelection}
                >
                  <Trash2 size={16} />
                </Button>
              </Tooltip>
            </div>
          </div>
          {stations.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm border border-divider bg-content1/95 p-6 text-center shadow-lg shadow-black/20">
                <Box size={28} aria-hidden className="mx-auto mb-3 text-primary" />
                <h2 className="text-lg font-semibold">Start with a station</h2>
                <p className="mt-1 text-sm text-foreground/65">
                  Open Build to add a station, then place machines and draw routes on its floor.
                </p>
              </div>
            </div>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="pointer-events-none absolute bottom-4 left-4 max-w-xs border border-divider bg-content1 px-3 py-2 text-xs text-foreground shadow-md"
            >
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      <BuildPaletteModal open={paletteOpen} onOpenChange={setPaletteOpen} tool={tool} onSelect={selectTool} onAddStation={add} />

      <Modal isOpen={deleteOpen} onOpenChange={setDeleteOpen} placement="center" classNames={{ base: 'rounded-sm bg-content1' }}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Remove station?</ModalHeader>
              <ModalBody>
                <p className="text-sm text-foreground/75">
                  {activeStation?.name} and everything placed inside it will be removed from this session.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    if (activeStation && !removeStation(activeStation.id)) {
                      setNotice('Remove the parts linked across this station doorway before deleting it.')
                      onClose()
                      return
                    }
                    setActiveStationId(null)
                    setSelectedPart(null)
                    onClose()
                  }}
                >
                  Remove station
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
