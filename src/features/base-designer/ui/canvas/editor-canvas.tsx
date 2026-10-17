import type Konva from 'konva'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Group, Layer, Rect, Stage } from 'react-konva'
import { zoomAt } from '../../lib/camera'
import { CELL_SIZE, type Point, type Scene, type Selection, type Station } from '../../model/scene'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import { stationCorridors } from '../../lib/stations'
import type { BeltNetwork } from '../../lib/belt-network'
import type { ProductionAnalysis } from '../../lib/production-analysis'
import type { HoveredPort } from '../port-hint'
import { cancelCanvasDrag } from './cancel-drag'
import { CorridorGraphic, StationShape } from '../elements/station'
import { BuildingShape } from '../elements/building'
import { BeltLayer } from '../elements/belt'
import { SplitterShape, TunnelShape } from '../elements/logistics'
import { ToolPreview } from '../tools/tool-preview'
import { paintPreview } from '../tools/preview'
import type { useEditorTools } from '../tools/use-editor-tools'
import { toolPoint } from '../../lib/tool-drafts'
import { CanvasGrid } from './grid'
import { CanvasControls } from './canvas-controls'
import { createViewportUpdater } from './viewport'
import { useSelectionBox } from './use-selection-box'
import { useSelectionMove } from './use-selection-move'
import { useCameraPan } from './use-camera-pan'
import { useCanvasArtwork } from './use-canvas-artwork'
import { GroupPreview } from '../tools/group-preview'
import { groupBounds } from '../../lib/scene-geometry'

const emptyRoles: Readonly<Record<string, 'input' | 'output'>> = {}

/** Hit children inherit their owning scene identity, including the hit node itself.
 * Port metadata deliberately stays on the exact hit instead: inheriting it could turn a body click into a port action.
 */
function selectionTarget(target: Konva.Node): Selection | undefined {
  return target.findAncestor((node: Konva.Node) => !!node.getAttr('selection'), true)?.getAttr('selection')
}

/** Own camera, hit dispatch and graphic previews for one confirmed scene/network/analysis snapshot.
 * Konva owns capture; tools own transient edits and delegate confirmation to the store.
 */
export function EditorCanvas({
  scene,
  network,
  analysis,
  tools,
  stageRef,
  containerRef,
  commands,
  onOpenCargo,
  onOpenRecipe,
  onHoverPort,
  onTogglePort,
  portHint,
  details,
}: {
  scene: Scene
  network: BeltNetwork
  analysis: ProductionAnalysis
  tools: ReturnType<typeof useEditorTools>
  stageRef: RefObject<Konva.Stage | null>
  containerRef: RefObject<HTMLDivElement | null>
  commands: ReactNode
  onOpenCargo: (stationId: string, slot: 0 | 1) => void
  onOpenRecipe: (buildingId: string) => void
  /** Report inspection identity changes; machine-body position follows CSS without React updates per movement. */
  onHoverPort: (port: HoveredPort | null) => void
  /** Forward an exact-hit owner and local output key; the store revalidates its current permissions. */
  onTogglePort: (target: Selection, key: string) => void
  portHint: ReactNode
  details: ReactNode
}) {
  const { tool, setFeedback, pointer: resolvePointer } = tools
  const [size, setSize] = useState({ width: 0, height: 0 })
  const { image, corridorImage, droneImage, imageFailed } = useCanvasArtwork()
  const previewRef = useRef<Konva.Group | null>(null)
  const selectionBoxRef = useRef<Konva.Rect | null>(null)
  const moveRef = useRef<Konva.Group | null>(null)
  const corridorRef = useRef<Konva.Shape | null>(null)
  const viewportUpdate = useRef<() => void>(() => {})
  const corridors = useMemo(() => stationCorridors(scene.stations), [scene.stations])
  const pointerInside = useRef(false)
  const previewCell = useRef<{ point: Point; normal?: Point } | null>(null)
  const hoveredPort = useRef<{ owner: Selection; key: string } | null>(null)
  /** Hint identity changes in React; body position follows local screen pixels through CSS without rerendering content. */
  const inspectPort = (node?: Konva.Node) => {
    const owner = node && selectionTarget(node),
      key: string | undefined = node?.getAttr('portKey') ?? (owner?.kind === 'building' ? 'body' : undefined)
    const next = owner && key ? { owner, key } : null
    const before = hoveredPort.current
    const pointer = next ? stageRef.current?.getPointerPosition() : null
    if (next?.owner.kind === 'building' && next.key === 'body' && pointer && tool.kind === 'select') {
      containerRef.current?.style.setProperty('--machine-pointer-x', `${pointer.x + 16}px`)
      containerRef.current?.style.setProperty('--machine-pointer-y', `${pointer.y + 16}px`)
    }
    if (before?.owner.id === next?.owner.id && before?.key === next?.key) return
    hoveredPort.current = next
    onHoverPort(next && pointer && tool.kind === 'select' ? { owner: next.owner, key: next.key, ...pointer } : null)
  }
  const ready = size.width > 0 && size.height > 0
  const pan = useCameraPan(stageRef, ready)
  const box = useSelectionBox({ stageRef, rectangleRef: selectionBoxRef, tool: tools.tool, ready, scene, selectArea: tools.selectArea })
  const previewScene = useCallback((next: readonly Station[] | null) => {
    const shape = corridorRef.current
    shape?.setAttrs({ corridors: stationCorridors(next ?? useBaseDesignerStore.getState().stations) })
    shape?.getLayer()?.batchDraw()
  }, [])
  const move = useSelectionMove({
    stageRef,
    groupRef: moveRef,
    scene,
    tool: tools.tool,
    ready,
    selections: tools.selections,
    select: tools.setSelections,
    feedback: tools.setFeedback,
    previewScene,
  })
  const refreshViewport = useCallback(() => {
    viewportUpdate.current()
  }, [])
  useLayoutEffect(() => {
    const stage = stageRef.current
    viewportUpdate.current = stage ? createViewportUpdater(stage, stage.find('.viewport-element')) : () => {}
    refreshViewport()
    // React Konva lowercases event props; this native event is named beforeDraw.
    const floor = stageRef.current?.getLayers()[0]
    floor?.on('beforeDraw.viewport', refreshViewport)
    return () => {
      floor?.off('.viewport')
      viewportUpdate.current = () => {}
    }
  }, [
    scene.belts,
    scene.buildings,
    scene.stations,
    scene.splitters,
    scene.tunnels,
    tools.selectedIds,
    size,
    ready,
    stageRef,
    refreshViewport,
  ])

  useLayoutEffect(() => {
    const stage = stageRef.current
    // Parent cleanup precedes Stage destruction, whose dragend would otherwise commit the preview.
    return () => cancelCanvasDrag(stage)
  }, [stageRef, ready, size])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      hoveredPort.current = null
      onHoverPort(null)
      if (entry.contentRect.width <= 0 || entry.contentRect.height <= 0) cancelCanvasDrag(stageRef.current)
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [containerRef, stageRef, onHoverPort])

  /** Update ghost pixels and validity only; no scenario state changes while hovering.
   * Port cell/normal come from the exact hit, while scene/tool changes invalidate the last cell/face proposal.
   */
  const refreshPreview = useCallback(
    (target?: Konva.Node) => {
      const stage = stageRef.current
      const preview = previewRef.current
      if (!pointerInside.current || !preview || !stage || stage.isDragging() || moveRef.current?.isDragging()) return
      const pointer = stage.getRelativePointerPosition()
      if (!pointer) return
      const screen = stage.getPointerPosition()
      // Pointer events already carry Konva's hit target; a second canvas readback is unnecessary.
      const hit = target ?? (screen ? stage.getIntersection(screen) : null)
      const { point, normal } = resolvePointer(pointer, hit?.getAttr('portCell'), hit?.getAttr('portNormal')),
        previous = previewCell.current
      // Keep the indicator under the free pointer; route validation remains limited to cell/face changes.
      if (tool.kind === 'belt') {
        const cursor = preview.findOne<Konva.Shape>('.anchor-cursor')
        cursor?.position(pointer)
        cursor?.scale({ x: 1 / stage.scaleX(), y: 1 / stage.scaleY() })
        cursor?.setAttr('overPort', !!hit?.getAttr('portKey'))
      }
      if (
        previous &&
        previous.point.x === point.x &&
        previous.point.y === point.y &&
        previous.normal?.x === normal?.x &&
        previous.normal?.y === normal?.y
      )
        return
      previewCell.current = { point, normal }
      const issue = paintPreview(preview, tool, scene, pointer, point, normal)
      setFeedback(issue ?? null)
    },
    [scene, stageRef, tool, setFeedback, resolvePointer],
  )

  useLayoutEffect(() => {
    previewCell.current = null
    refreshPreview()
  }, [refreshPreview])

  useEffect(() => {
    hoveredPort.current = null
    onHoverPort(null)
  }, [tool, onHoverPort])

  /** Stage owns the camera. React observes only its zoom label, not every pointer movement. */
  function changeZoom(factor: number, anchor = { x: size.width / 2, y: size.height / 2 }) {
    inspectPort()
    cancelCanvasDrag(stageRef.current)
    const stage = stageRef.current
    if (!stage) return
    const next = zoomAt({ ...stage.position(), zoom: stage.scaleX() }, anchor, factor)
    stage.position(next)
    stage.scale({ x: next.zoom, y: next.zoom })
    refreshViewport()
    refreshPreview()
  }

  /** Center the whole confirmed layout at 100%; neither selection nor viewport size changes the requested zoom. */
  function centerScene() {
    inspectPort()
    cancelCanvasDrag(stageRef.current)
    const stage = stageRef.current,
      bounds = groupBounds(useBaseDesignerStore.getState())
    if (!stage) return
    stage.setAttrs({
      scaleX: 1,
      scaleY: 1,
      x: size.width / 2 - (bounds ? (bounds.x + bounds.width / 2) * CELL_SIZE : 0),
      y: size.height / 2 - (bounds ? (bounds.y + bounds.height / 2) * CELL_SIZE : 0),
    })
    refreshViewport()
    previewCell.current = null
    refreshPreview()
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Base canvas"
      onKeyDownCapture={(event) => {
        // Canvas controls may stop bubbling; protected panels and fields still own their keys.
        if (event.target instanceof HTMLElement && event.target.closest('#base-production-panel')) return
        if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key.toLowerCase() === 'c') {
          event.preventDefault()
          centerScene()
        } else if (event.key.toLowerCase() === 'f') {
          event.preventDefault()
          // Output switches remain available during drafts; changing a port does not require abandoning the active tool.
          // Resolve the current hit, so deleting or moving the formerly hovered actor cannot leave a stale F target.
          const stage = stageRef.current,
            pointer = pointerInside.current ? stage?.getPointerPosition() : undefined,
            hit = pointerInside.current && pointer ? stage?.getIntersection(pointer) : null
          const owner = hit && selectionTarget(hit),
            key: string | undefined = hit?.getAttr('outputKey')
          if (owner && key) onTogglePort(owner, key)
        }
      }}
      className="relative min-h-0 flex-1 overflow-hidden outline-none"
      style={{ cursor: tools.tool.kind === 'select' || tools.tool.kind === 'belt' ? 'default' : 'crosshair' }}
    >
      {ready ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onContextMenu={(event) => event.evt.preventDefault()}
          onMouseDown={(event) => {
            pointerInside.current = true
            containerRef.current?.focus({ preventScroll: true })
            if (event.evt.button === 1) {
              event.evt.preventDefault()
              const picked = selectionTarget(event.target)
              if (picked) {
                box.cancel()
                inspectPort()
                tools.pickTool(picked)
              }
            } else if (event.evt.button === 2) {
              inspectPort()
              move.cancel()
              box.cancel()
              event.evt.preventDefault()
              pan.start()
              stageRef.current?.startDrag(event)
            } else if (event.evt.button === 0) {
              const picked = selectionTarget(event.target)
              if (!move.down(event, picked)) box.down(event, picked, false)
            }
          }}
          onMouseMove={(event) => {
            pointerInside.current = true
            box.move()
            move.move()
            refreshPreview(event.target)
            inspectPort(stageRef.current?.isDragging() || moveRef.current?.isDragging() ? undefined : event.target)
          }}
          onMouseLeave={() => {
            inspectPort()
            box.cancel()
            pointerInside.current = false
            previewCell.current = null
            previewRef.current?.visible(false)
          }}
          onMouseUp={(event) => {
            if (event.evt.button === 0) {
              box.up(event)
              move.up()
              return
            }
            if (event.evt.button !== 2) return
            if (pan.finish() === false) tools.rightClick()
          }}
          onClick={(event) => {
            if (event.evt.button !== 0) return
            const stage = stageRef.current
            if (!stage) return
            if (tools.tool.kind === 'select') {
              if (box.consumeClick() || move.consumeClick()) return
              const picked = selectionTarget(event.target),
                target: Konva.Node = event.target,
                pointer = stage.getRelativePointerPosition()
              // Only an unmodified click on a free end starts drawing; drags and additive selection keep their gestures.
              if (
                pointer &&
                !event.evt.ctrlKey &&
                !event.evt.metaKey &&
                !event.evt.shiftKey &&
                !event.evt.altKey &&
                (!picked || picked.kind === 'belt' || picked.kind === 'station') &&
                tools.continueBelt(
                  target.getAttr('portCell') ?? toolPoint({ kind: 'belt', points: [] }, pointer),
                  picked?.kind === 'belt' ? picked.id : undefined,
                )
              )
                return
              tools.select(picked ?? null, event.evt.ctrlKey || event.evt.metaKey, event.evt.shiftKey)
              return
            }
            const pointer = stage.getRelativePointerPosition()
            if (!pointer) return
            const target: Konva.Node = event.target
            tools.click(pointer, target.getAttr('portCell'), target.getAttr('portNormal'))
            refreshPreview(target)
          }}
          onWheel={(event) => {
            inspectPort()
            event.evt.preventDefault()
            const pointer = stageRef.current?.getPointerPosition()
            if (!pointer || event.evt.deltaY === 0) return
            const zoomIn = event.evt.ctrlKey ? event.evt.deltaY > 0 : event.evt.deltaY < 0
            changeZoom(zoomIn ? 1.1 : 1 / 1.1, pointer)
          }}
          onDblClick={(event) => {
            const node: Konva.Node = event.target
            if (
              tools.tool.kind !== 'select' ||
              event.evt.button !== 0 ||
              event.evt.ctrlKey ||
              event.evt.metaKey ||
              event.evt.shiftKey ||
              event.evt.altKey ||
              node.getAttr('portCell')
            )
              return
            const target = selectionTarget(node)
            if (target?.kind === 'building') onOpenRecipe(target.id)
          }}
          onDragMove={(event) => {
            if (event.target !== stageRef.current) return
            // Hide the ghost during navigation; keep anchors and validate the destination on release.
            previewRef.current?.visible(false)
            previewCell.current = null
          }}
          onDragEnd={(event) => {
            if (event.target !== stageRef.current) return
            pan.finish()
            refreshPreview()
          }}
        >
          <Layer>
            <CanvasGrid />
            {scene.stations
              .filter((station) => station.type !== 'drone')
              .map((station) => (
                <StationShape
                  key={station.id}
                  station={station}
                  image={image}
                  droneImage={droneImage}
                  connected={network.connectedPorts}
                  onOpenCargo={onOpenCargo}
                  selected={tools.selectedIds.has(station.id)}
                  interactive={tools.tool.kind === 'select'}
                />
              ))}
            <CorridorGraphic corridors={corridors} image={corridorImage} shapeRef={corridorRef} />
          </Layer>
          <BeltLayer
            scene={scene}
            network={network}
            selectedIds={tools.selectedIds}
            draftingBeltId={tools.tool.kind === 'belt' ? tools.tool.extension?.id : undefined}
          />
          <Layer>
            {scene.stations
              .filter((station) => station.type === 'drone')
              .map((station) => (
                <StationShape
                  key={station.id}
                  station={station}
                  image={image}
                  droneImage={droneImage}
                  connected={network.connectedPorts}
                  onOpenCargo={onOpenCargo}
                  selected={tools.selectedIds.has(station.id)}
                  interactive={tools.tool.kind === 'select'}
                />
              ))}
            {(scene.splitters ?? []).map((splitter) => (
              <SplitterShape
                key={splitter.id}
                splitter={splitter}
                selected={tools.selectedIds.has(splitter.id)}
                connected={network.connectedPorts}
              />
            ))}
            {scene.buildings.map((building) => (
              <BuildingShape
                key={building.id}
                building={building}
                selected={tools.selectedIds.has(building.id)}
                roles={network.portRoles.get(building.id) ?? emptyRoles}
                analysis={analysis.machines.get(building.id)}
              />
            ))}
            {(scene.tunnels ?? []).map((tunnel) => (
              <TunnelShape key={tunnel.id} tunnel={tunnel} selected={tools.selectedIds.has(tunnel.id)} connected={network.connectedPorts} />
            ))}
            <ToolPreview tool={tools.tool} image={image} corridorImage={corridorImage} droneImage={droneImage} groupRef={previewRef} />
            {move.snapshot && (
              <Group
                ref={moveRef}
                name="selection-move scene-element"
                listening={false}
                opacity={0.8}
                onDragMove={move.dragMove}
                onDragEnd={move.dragEnd}
              >
                <GroupPreview scene={move.snapshot} image={image} corridorImage={corridorImage} droneImage={droneImage} />
              </Group>
            )}
            <Rect
              ref={selectionBoxRef}
              name="selection-box"
              visible={false}
              fill="rgba(244,176,85,0.08)"
              stroke="#f4b055"
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={false}
            />
          </Layer>
        </Stage>
      ) : null}
      {portHint}
      {details}
      {imageFailed ? (
        <p role="alert" className="absolute left-3 top-3 text-sm text-danger">
          Canvas artwork could not load.
        </p>
      ) : null}
      {scene.stations.length === 0 && tools.tool.kind === 'select' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="max-w-sm text-sm text-foreground-500">Choose Station 1×1 to place your first module.</p>
        </div>
      ) : null}
      {/* Keep the live region mounted; bottom placement and stacking preserve feedback above panels and wrapped controls without capturing input. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center"
      >
        {tools.feedback && <p className="max-w-md rounded-md bg-content1 px-3 py-2 text-xs text-danger shadow-md">{tools.feedback}</p>}
      </div>
      {ready ? <CanvasControls commands={commands} stageRef={stageRef} onZoom={changeZoom} onCenter={centerScene} /> : null}
    </div>
  )
}
