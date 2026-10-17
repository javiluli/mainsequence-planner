import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import type { Point, Scene, Selection } from '../../model/scene'
import { beltDraftPoints, canFinishOneCellBelt, proposeBeltDraft, tunnelDraft, toolPoint, type EditorTool } from '../../lib/tool-drafts'
import { beltToExtend, samePoint } from '../../lib/belts'
import { canPlaceTunnel, canStartTunnel, beltPlacementIssue, tunnelPlacementIssue } from '../../lib/placement'
import { canRotateClipboard, captureClipboard, placementAt, placementIssue, rotateClipboard, type ClipboardItem } from '../../lib/clipboard'
import { cancelCanvasDrag } from '../canvas/cancel-drag'
import {
  allSelections,
  proposeSelectionRemoval,
  selectElement,
  selectionExists,
  selectionScene,
  selectInRectangle,
} from '../../lib/selection'
import { captureGroupClipboard, checkGroupPlacement } from '../../lib/clipboard-group'
import { proposeSelectionTransform } from '../../lib/selection-transform'
import { selectionPivot } from '../../lib/scene-geometry'
import { indexBeltPorts, resolveBeltPointer } from '../../lib/belt-pointer'

/** Own selection, clipboard and draft anchors; all confirmed edits pass through store validation. */
export function useEditorTools(stageRef: RefObject<Konva.Stage | null>, containerRef: RefObject<HTMLDivElement | null>) {
  const [tool, setTool] = useState<EditorTool>({ kind: 'select' })
  const [chosen, setChosen] = useState<readonly Selection[]>([])
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const rotation = useRef<{ from: Scene; selection: readonly Selection[]; pivot: Point } | null>(null)
  const scene = useBaseDesignerStore.getState()
  const { buildings, stations, splitters, tunnels } = scene
  const ports = useMemo(() => indexBeltPorts({ buildings, stations, splitters, tunnels }), [buildings, stations, splitters, tunnels])
  /** Preview and clicks share one socket proposal; pointer motion never writes editor or scene state. */
  const pointer = useCallback(
    (world: Point, port?: Point, normal?: Point) =>
      tool.kind === 'belt' ? resolveBeltPointer(ports, world, port, normal) : { point: toolPoint(tool, world, port), normal },
    [ports, tool],
  )
  // Filter stale IDs once; the single target below is already a confirmed member of this selection.
  const selections = useMemo(() => chosen.filter((item) => selectionExists(scene, item)), [chosen, scene])
  const selectedIds = useMemo(() => new Set(selections.map((item) => item.id)), [selections])
  const selection = selections.length === 1 ? selections[0] : null
  const setSelection = useCallback((item: Selection | null) => {
    rotation.current = null
    setChosen(item ? [item] : [])
    setFeedback(null)
  }, [])
  const setSelections = useCallback((items: readonly Selection[]) => {
    rotation.current = null
    setChosen(items)
    setFeedback(null)
  }, [])
  /** Modifier clicks act on current confirmed IDs; Shift also removes stations from an additive result. */
  const select = useCallback((item: Selection | null, additive: boolean, piecesOnly: boolean) => {
    rotation.current = null
    setFeedback(null)
    setChosen((current) =>
      selectElement(
        current.filter((target) => selectionExists(useBaseDesignerStore.getState(), target)),
        item,
        additive,
        piecesOnly,
      ),
    )
  }, [])
  /** Read current confirmed geometry at release, replacing selection without confirming any scene edit. */
  const selectArea = useCallback((from: Point, to: Point, piecesOnly: boolean) => {
    rotation.current = null
    setFeedback(null)
    setChosen(selectInRectangle(useBaseDesignerStore.getState(), from, to, piecesOnly))
  }, [])

  /** Cancel native gestures and reset draft context, preserving the explicit selection and session clipboard. */
  function chooseTool(next: EditorTool) {
    rotation.current = null
    cancelCanvasDrag(stageRef.current)
    setFeedback(null)
    setTool(next)
    containerRef.current?.focus({ preventScroll: true })
  }

  /** A free final cell starts one continuation draft; selection and the belt tool share its identity/tier rules. */
  function continueBelt(point: Point, id?: string): boolean {
    const extension = beltToExtend(useBaseDesignerStore.getState(), point)
    if (!extension || (id !== undefined && extension.id !== id)) return false
    chooseTool({
      kind: 'belt',
      type: tool.kind === 'belt' ? tool.type : extension.type,
      points: [point],
      extension,
      clickEnds: [1],
    })
    setSelection({ kind: 'belt', id: extension.id })
    return true
  }

  /** Escape cancels a gesture first; an idle selection tool clears its targets without touching the clipboard. */
  function escape() {
    const stage = stageRef.current,
      gesture = stage?.find('.scene-element').some((node) => node.isDragging()) || stage?.findOne('.selection-box')?.visible()
    if (tool.kind === 'select' && !gesture) setSelection(null)
    chooseTool({ kind: 'select' })
  }

  /** Cancel the current gesture before selecting current IDs; the pieces-only shortcut excludes all station kinds. */
  function selectAll(piecesOnly: boolean) {
    chooseTool({ kind: 'select' })
    setChosen(allSelections(useBaseDesignerStore.getState(), piecesOnly))
  }

  /** Keyboard movement uses exactly the same final-layout proposal and history as pointer movement. */
  function nudge(offset: Point) {
    cancelCanvasDrag(stageRef.current)
    const store = useBaseDesignerStore.getState(),
      transform = { kind: 'move' as const, offset }
    // Accepted commands need only the store's final validation; rejected commands still explain the same proposal.
    setFeedback(store.transformElements(selections, transform) ? null : proposeSelectionTransform(store, selections, transform).issue)
  }

  /** Cancel native and draft gestures before restoring a confirmed scene; clipboard is never rewound. */
  function restoreHistory(direction: 'undo' | 'redo') {
    const store = useBaseDesignerStore.getState()
    if (!(direction === 'undo' ? store.past.length : store.future.length)) return
    chooseTool({ kind: 'select' })
    setSelection(null)
    store[direction]()
  }

  /** Removal changes clipboard only after a successful cut, so failed cuts cannot lose an earlier copy. */
  function remove(cut = false) {
    cancelCanvasDrag(stageRef.current)
    if (!selections.length) return
    const store = useBaseDesignerStore.getState()
    const item = cut ? ((selection ? captureClipboard(store, selection) : null) ?? captureGroupClipboard(store, selections)) : null
    if ((cut && !item) || !store.removeElements(selections)) {
      setFeedback('Include every piece that would lose floor support. Nothing was removed.')
      return
    }
    setFeedback(null)
    if (item) setClipboard(item)
    setSelection(null)
    setTool({ kind: 'select' })
    containerRef.current?.focus({ preventScroll: true })
  }

  /** Copy explicit confirmed targets without removal or history; rejected captures preserve the previous clipboard. */
  function copy() {
    cancelCanvasDrag(stageRef.current)
    const store = useBaseDesignerStore.getState()
    const item = (selection ? captureClipboard(store, selection) : null) ?? captureGroupClipboard(store, selections)
    if (!item) return
    setClipboard(item)
    chooseTool({ kind: 'select' })
  }

  /** Middle-click picks a fresh catalog tool; only the requested machine recipe is inherited, never route geometry or clipboard. */
  function pickTool(target: Selection): boolean {
    const store = useBaseDesignerStore.getState()
    if (target.kind === 'belt') {
      const belt = store.belts.find((item) => item.id === target.id)
      if (!belt) return false
      chooseTool({ kind: 'belt', type: belt.type ?? 'conveyor', points: [] })
      return true
    }
    if (target.kind === 'tunnel') {
      const tunnel = store.tunnels.find((item) => item.id === target.id)
      if (!tunnel) return false
      chooseTool({ kind: 'tunnel', type: tunnel.type })
      return true
    }
    if (target.kind === 'station') {
      const station = store.stations.find((item) => item.id === target.id)
      if (!station) return false
      chooseTool({
        kind: 'place',
        item:
          station.type === 'drone'
            ? { kind: 'station', type: 'drone', rotation: 0, cargo: [null, null] }
            : { kind: 'station', type: station.type === 'station_2x2_b' ? 'station_2x2_a' : station.type },
      })
      return true
    }
    const item = captureClipboard(store, target)
    if (!item) return false
    if (item.kind === 'building')
      chooseTool({
        kind: 'place',
        item: { kind: 'building', type: item.type, rotation: 0, ...(item.recipeId !== undefined && { recipeId: item.recipeId }) },
      })
    else if (item.kind === 'splitter') chooseTool({ kind: 'place', item: { kind: 'splitter', type: item.type, rotation: 0 } })
    else return false
    return true
  }

  /** Turn the paste preview or confirmed selection, retaining its pivot until selection or geometry changes. */
  function rotate() {
    cancelCanvasDrag(stageRef.current)
    if (tool.kind === 'place') {
      const turned = rotateClipboard(tool.item, tool.pivot)
      if (turned) setTool({ kind: 'place', ...turned })
      return
    }
    if (tool.kind !== 'select') return
    const store = useBaseDesignerStore.getState(),
      snapshot = selectionScene(store, selections)
    if (!snapshot) return
    const previous = rotation.current,
      sameSelection =
        previous?.selection.length === selections.length && selections.every((target, index) => target.id === previous.selection[index].id),
      sameScene =
        previous && (['stations', 'buildings', 'belts', 'splitters', 'tunnels'] as const).every((key) => previous.from[key] === store[key]),
      pivot = sameSelection && sameScene ? previous.pivot : selectionPivot(snapshot),
      transform = { kind: 'rotate' as const, pivot },
      applied = store.transformElements(selections, transform)
    setFeedback(applied ? null : proposeSelectionTransform(store, selections, transform).issue)
    if (applied) rotation.current = { from: useBaseDesignerStore.getState(), selection: selections, pivot }
  }

  /** An exact I/O hit completes a valid started belt; free cells keep anchors and the repeated-click finish. */
  function click(world: Point, port?: Point, normal?: Point) {
    if (tool.kind === 'select') return
    const store = useBaseDesignerStore.getState(),
      { point, normal: portNormal } = pointer(world, port, normal)
    if (tool.kind === 'place') {
      if (tool.item.kind === 'group') {
        const pasted = store.pasteGroup(tool.item.scene, point)
        setFeedback(pasted ? null : checkGroupPlacement(store, tool.item.scene, point).issue)
        if (pasted) setChosen(pasted)
        return
      }
      const placement = placementAt(store, tool.item, point)
      setFeedback(placementIssue(store, placement))
      const id =
        placement.kind === 'station'
          ? store.addStation(placement.value)
          : placement.kind === 'building'
            ? store.addBuilding(placement.value)
            : placement.kind === 'splitter'
              ? store.addSplitter(placement.value)
              : placement.kind === 'tunnel'
                ? store.addTunnel(placement.value)
                : store.addBelt(placement.value)
      if (id) {
        setSelection({ kind: placement.kind, id })
      }
      return
    }
    if (tool.kind === 'tunnel') {
      if (!tool.entry) {
        // First click may sit on an existing aligned endpoint; the complete tunnel is validated on the second click.
        if (canStartTunnel(store, point)) {
          setFeedback(null)
          setTool({ ...tool, entry: point })
        } else setFeedback('Choose a free floor cell for the underground entry.')
        return
      }
      const proposal = tunnelDraft(tool, point)
      if (!canPlaceTunnel(store, proposal)) {
        setFeedback(tunnelPlacementIssue(store, proposal))
        return
      }
      setFeedback(null)
      const id = store.addTunnel(proposal)
      if (id) {
        setSelection({ kind: 'tunnel', id })
        setTool({ kind: 'tunnel', type: tool.type })
      }
      return
    }
    const last = tool.points.at(-1)
    if (!last && continueBelt(point)) return
    const draft = proposeBeltDraft(tool, store, point, portNormal)
    if (!draft.valid) {
      setFeedback(
        beltPlacementIssue(
          store,
          { points: beltDraftPoints(tool, draft.points), ...(draft.heading && { heading: draft.heading }) },
          tool.extension?.id,
        ),
      )
      return
    }
    // Proximity can suggest a socket, but only the hit's explicit metadata authorizes immediate completion.
    if (last && (samePoint(last, point) || (port && normal))) {
      const points = beltDraftPoints(tool, draft.points)
      const heading = draft.heading
      if (points.length === 1 && !tool.extension && !canFinishOneCellBelt(store, { points, heading }, portNormal)) return
      const id = tool.extension
        ? store.extendBelt({ id: tool.extension.id, from: tool.extension.points, points })
          ? tool.extension.id
          : null
        : store.addBelt({ points, ...(tool.type ? { type: tool.type } : {}), ...(heading ? { heading } : {}) })
      if (id) {
        setFeedback(null)
        setSelection({ kind: 'belt', id })
        setTool({ kind: 'belt', type: tool.type, points: [] })
      }
      return
    }
    setFeedback(null)
    setTool({
      ...tool,
      points: draft.points,
      clickEnds: [...(tool.clickEnds ?? []), draft.points.length],
      ...(!last && portNormal ? { startNormal: portNormal } : {}),
    })
  }

  /** Undo the last logical destination, including its automatic elbow, or clear the provisional tunnel entry. */
  function rightClick() {
    if (tool.kind === 'tunnel') {
      setTool({ kind: 'tunnel', type: tool.type })
      return
    }
    if (tool.kind !== 'belt') return
    const end = tool.clickEnds?.at(-2) ?? tool.points.length - 1
    setTool(
      tool.points.length <= 1
        ? { kind: 'belt', type: tool.type, points: [] }
        : { ...tool, points: tool.points.slice(0, end), clickEnds: tool.clickEnds?.slice(0, -1) },
    )
  }

  const selectedStation = selection?.kind === 'station' ? scene.stations.find((s) => s.id === selection.id) : undefined
  const removable = useMemo(() => !!proposeSelectionRemoval(scene, selections), [scene, selections])
  const rotatable =
    (tool.kind === 'place' && canRotateClipboard(tool.item)) ||
    (tool.kind === 'select' &&
      selections.length > 0 &&
      (selections.length > 1 || selection?.kind !== 'station' || selectedStation?.type === 'drone'))
  return {
    tool,
    pointer,
    continueBelt,
    selection,
    selections,
    selectedIds,
    setSelection,
    setSelections,
    select,
    selectArea,
    clipboard,
    chooseTool,
    restoreHistory,
    click,
    rightClick,
    remove,
    copy,
    pickTool,
    rotate,
    escape,
    selectAll,
    nudge,
    feedback,
    setFeedback,
    removable,
    copyable: selections.length > 0,
    rotatable,
  }
}
