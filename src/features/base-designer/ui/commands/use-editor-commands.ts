import { useCallback, useEffect, type RefObject } from 'react'
import { type QuarterTurn } from '../../lib/layout/layout-transform'

interface EditorCommandOptions {
  canvasRef: RefObject<HTMLElement | null>
  blocked: boolean
  canCopy: boolean
  canPaste: boolean
  canDelete: boolean
  canRotateTarget: boolean
  canRotatePreview: boolean
  canUndo: boolean
  canRedo: boolean
  onCopy: () => void
  onPaste: () => void
  onDelete: () => void
  onCut: () => void
  onRotateTarget: () => void
  onRotatePreview: (turn: QuarterTurn) => boolean
  onHistory: (action: 'undo' | 'redo') => void
  onCancel: () => void
  onToggleHoveredOutput: () => boolean
}

function editingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest('input, textarea, select, [role="dialog"]')))
}

/** Toolbar and keyboard share availability and execution; geometry and mutations stay with their owning operations. */
export function useEditorCommands(options: EditorCommandOptions) {
  const {
    canvasRef,
    blocked,
    onCopy,
    onPaste,
    onDelete,
    onCut,
    onRotateTarget,
    onRotatePreview,
    onHistory,
    onCancel,
    onToggleHoveredOutput,
  } = options
  const canCopy = !blocked && options.canCopy
  const canPaste = !blocked && options.canPaste
  const canDelete = !blocked && options.canDelete
  const canCut = canCopy && canDelete
  const canRotate = !blocked && (options.canRotatePreview || options.canRotateTarget)
  const canUndo = !blocked && options.canUndo
  const canRedo = !blocked && options.canRedo
  const copy = useCallback(() => {
    if (canCopy) onCopy()
  }, [canCopy, onCopy])
  const paste = useCallback(() => {
    if (canPaste) onPaste()
  }, [canPaste, onPaste])
  const remove = useCallback(() => {
    if (canDelete) onDelete()
  }, [canDelete, onDelete])
  const cut = useCallback(() => {
    // Never turn an unsupported deletion (e.g. multiple nodes) into a silent copy-only Cut.
    if (!canCut) return
    onCut()
  }, [canCut, onCut])
  const rotate = useCallback(() => {
    if (!canRotate) return
    if (!onRotatePreview(1) && options.canRotateTarget) onRotateTarget()
  }, [canRotate, onRotatePreview, onRotateTarget, options.canRotateTarget])
  const undo = useCallback(() => {
    if (!blocked) {
      if (canUndo) onHistory('undo')
      else onCancel()
    }
  }, [blocked, canUndo, onHistory, onCancel])
  const redo = useCallback(() => {
    if (!blocked) {
      if (canRedo) onHistory('redo')
      else onCancel()
    }
  }, [blocked, canRedo, onHistory, onCancel])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (blocked || editingTarget(event.target) || event.defaultPrevented || event.altKey) return false
      // Held command keys must not duplicate transactions. Canvas navigation is pointer-only.
      if (event.repeat) return false
      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        onCancel()
      } else if (!command && key === 'r' && canRotate) {
        rotate()
      } else if (!command && key === 'f') {
        if (!onToggleHoveredOutput()) return false
      } else if (command && key === 'z') {
        if (event.shiftKey) redo()
        else undo()
      } else if (command && key === 'y') {
        redo()
      } else if (command && key === 'c') {
        copy()
      } else if (command && key === 'v') {
        paste()
      } else if (command && key === 'x') {
        cut()
      } else if (!command && (key === 'delete' || key === 'backspace')) {
        remove()
      } else return false
      event.preventDefault()
      return true
    },
    [blocked, onCancel, canRotate, rotate, onToggleHoveredOutput, redo, undo, copy, paste, cut, remove],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyDown(event)
    }
    // HeroUI press handlers can stop bubbling from buttons. defaultPrevented prevents a second execution at the canvas/window.
    const onButtonCommand = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey || event.key.toLowerCase() === 'r') &&
        event.target instanceof Element &&
        event.target.closest('button')
      )
        handleKeyDown(event)
    }
    window.addEventListener('keydown', onButtonCommand, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onCancel)
    return () => {
      window.removeEventListener('keydown', onButtonCommand, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onCancel)
    }
  }, [handleKeyDown, onCancel])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      if (blocked || event.defaultPrevented || event.ctrlKey || !event.deltaY || editingTarget(event.target)) return
      if (event.target instanceof Element && event.target.closest('button')) return
      // No preview means normal React Flow zoom. Rotation never turns the current selection on wheel.
      if (onRotatePreview(event.deltaY > 0 ? 1 : -1)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    canvas.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => canvas.removeEventListener('wheel', onWheel, true)
  }, [canvasRef, blocked, onRotatePreview])

  return {
    canCopy,
    canPaste,
    canDelete,
    canCut,
    canRotate,
    canUndo,
    canRedo,
    copy,
    paste,
    remove,
    cut,
    rotate,
    undo,
    redo,
    cancel: onCancel,
    handleKeyDown,
  }
}
