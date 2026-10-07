import { useCallback, useRef, useState } from 'react'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import type { BaseStation } from '../../lib/layout/placement'
import type { EditorSelection } from '../../model/editor-selection'
import { isProductMachine } from '../../lib/products/machine-recipes'

type PartTarget = Extract<EditorSelection, { kind: 'part' }>
type DialogPart = Pick<PartTarget, 'stationId' | 'placementId'>

interface EditorDialogOptions {
  stations: readonly BaseStation[]
  selectedPart: PartTarget | null
  canConfigureOutputs: boolean
  onPrepare: () => void
  setSelection: (selection: EditorSelection) => void
  onActivate: (stationId: string | null) => void
}

/**
 * Own dialog identities and focus restoration, never snapshots of products, permissions or selection.
 * Opening prepares the editing context first; rendered entities resolve from the current confirmed layout.
 * Clipboard/removal confirmation belongs to commands and is intentionally outside this lifecycle.
 */
export function useEditorDialogs({
  stations,
  selectedPart,
  canConfigureOutputs,
  onPrepare,
  setSelection,
  onActivate,
}: EditorDialogOptions) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const productToggleRef = useRef<HTMLButtonElement>(null)
  const [machineModalPart, setMachineModalPart] = useState<DialogPart | null>(null)
  const [portsModalPart, setPortsModalPart] = useState<DialogPart | null>(null)
  const [droneModalStationId, setDroneModalStationId] = useState<string | null>(null)
  const [activeDroneSlot, setActiveDroneSlot] = useState<0 | 1>(0)
  const droneModalStation = stations.find((station) => station.id === droneModalStationId && station.type === 'drone_station') ?? null
  const machineModalPlacement = machineModalPart
    ? stations
        .find((station) => station.id === machineModalPart.stationId)
        ?.placements.find((piece) => piece.id === machineModalPart.placementId)
    : undefined
  const portsModalPlacement = portsModalPart
    ? stations
        .find((station) => station.id === portsModalPart.stationId)
        ?.placements.find((piece) => piece.id === portsModalPart.placementId)
    : undefined
  // Invalidate the captured editing target before rendering children; Undo must not reopen a vanished target later.
  if (
    portsModalPart &&
    (!portsModalPlacement ||
      selectedPart?.stationId !== portsModalPart.stationId ||
      selectedPart.placementId !== portsModalPart.placementId)
  )
    setPortsModalPart(null)

  const openPalette = useCallback(() => {
    onPrepare()
    setPaletteOpen(true)
  }, [onPrepare])

  const openMachineItem = useCallback(
    (stationId: string, placementId: string) => {
      // The event may follow a confirmed write before React renders again: validate against the live store.
      const placement = useBaseDesignerStore
        .getState()
        .stations.find((station) => station.id === stationId)
        ?.placements.find((piece) => piece.id === placementId)
      if (!placement || !isProductMachine(placement.type)) return
      onPrepare()
      setSelection({ kind: 'part', stationId, placementId })
      onActivate(stationId)
      setDroneModalStationId(null)
      setMachineModalPart({ stationId, placementId })
    },
    [onPrepare, setSelection, onActivate],
  )

  const openSelectedProduct = useCallback(() => {
    if (selectedPart) openMachineItem(selectedPart.stationId, selectedPart.placementId)
  }, [selectedPart, openMachineItem])

  const openDroneOutput = useCallback(
    (stationId: string, slot: 0 | 1) => {
      onPrepare()
      setDroneModalStationId(stationId)
      setActiveDroneSlot(slot)
      setSelection({ kind: 'nodes', ids: [stationId] })
      setMachineModalPart(null)
    },
    [onPrepare, setSelection],
  )

  const openOutputs = useCallback(() => {
    if (!selectedPart || !canConfigureOutputs) return
    onPrepare()
    setPortsModalPart({ stationId: selectedPart.stationId, placementId: selectedPart.placementId })
  }, [selectedPart, canConfigureOutputs, onPrepare])

  const closeMachineItem = useCallback(() => {
    setMachineModalPart(null)
    requestAnimationFrame(() => {
      // Let the modal's focus scope finish restoring its trigger before returning to the editor.
      requestAnimationFrame(() => {
        productToggleRef.current?.focus({ preventScroll: true })
      })
    })
  }, [])
  const clearMachineTarget = useCallback(() => setMachineModalPart(null), [])
  const closePorts = useCallback(() => setPortsModalPart(null), [])
  const onDroneOpenChange = useCallback((open: boolean) => {
    if (!open) setDroneModalStationId(null)
  }, [])
  const clearProductTargets = useCallback(() => {
    setDroneModalStationId(null)
    setMachineModalPart(null)
  }, [])

  return {
    paletteOpen,
    setPaletteOpen,
    productToggleRef,
    machineModalPart,
    machineModalPlacement,
    portsModalPart,
    portsModalPlacement,
    droneModalStation,
    activeDroneSlot,
    setActiveDroneSlot,
    blocked: paletteOpen || machineModalPart !== null || droneModalStationId !== null || portsModalPart !== null,
    openPalette,
    openMachineItem,
    openSelectedProduct,
    openDroneOutput,
    openOutputs,
    closeMachineItem,
    clearMachineTarget,
    closePorts,
    onDroneOpenChange,
    clearProductTargets,
  }
}
