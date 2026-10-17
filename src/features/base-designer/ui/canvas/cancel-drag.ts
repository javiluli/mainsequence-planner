import type Konva from 'konva'

/** Cancel native drags before tool changes or teardown can turn them into confirmed releases. */
export function cancelCanvasDrag(stage: Konva.Stage | null) {
  stage?.fire('cancelCameraGesture')
  // The selection owner stops its carrier before native dragend can commit it.
  stage?.fire('cancelSelectionGesture')
  stage?.stopDrag()
}
