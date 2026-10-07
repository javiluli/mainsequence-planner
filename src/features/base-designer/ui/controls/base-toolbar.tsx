import { Button, Tooltip } from '@heroui/react'
import {
  Cable,
  ClipboardPaste,
  Copy,
  Hand,
  Package,
  Plus,
  Redo2,
  RotateCw,
  Scan,
  StickyNote,
  Trash2,
  Undo2,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useMemo, type RefObject } from 'react'
import type { BaseStorageIssue } from '@/store/base-designer/persistence'
import type { EditorTool } from '../../model/catalog'
import type { BaseStation } from '../../lib/layout/placement'
import { summarizeBaseEnergy } from '../../lib/products/catalog-machines'
import type { BaseCanvasInstance } from '../canvas/base-canvas'
import type { useEditorCommands } from '../commands/use-editor-commands'

interface BaseToolbarProps {
  storageIssue: BaseStorageIssue
  stations: readonly BaseStation[]
  tool: EditorTool
  pasteActive: boolean
  stationBuildActive: boolean
  hasLayout: boolean
  canChooseProduct: boolean
  canConfigureOutputs: boolean
  productToggleRef: RefObject<HTMLButtonElement | null>
  commands: ReturnType<typeof useEditorCommands>
  pasteDescription: string
  deleteDescription: string
  flow: Pick<BaseCanvasInstance, 'zoomIn' | 'zoomOut' | 'fitView'> | null
  onBuild: () => void
  onSelect: () => void
  onAddNote: () => void
  onProduct: () => void
  onOutputs: () => void
}

/**
 * Both control rows share the editor's commands; no local shortcuts or copy of tool/viewport state.
 * Energy/counts remain catalog-derived presentation, independent of routing and transient proposals.
 */
export function BaseToolbar({
  stations,
  storageIssue,
  tool,
  pasteActive,
  stationBuildActive,
  hasLayout,
  canChooseProduct,
  canConfigureOutputs,
  productToggleRef,
  commands,
  pasteDescription,
  deleteDescription,
  flow,
  onBuild,
  onSelect,
  onAddNote,
  onProduct,
  onOutputs,
}: BaseToolbarProps) {
  const {
    knownRequiredMj: knownEnergyUse,
    unknownMachineCount: unknownEnergyUse,
    reactorCount: reactors,
  } = useMemo(() => summarizeBaseEnergy(stations), [stations])
  const requiredEnergyLabel = unknownEnergyUse
    ? knownEnergyUse > 0
      ? `≥${knownEnergyUse.toFixed(1)} MJ`
      : '— MJ'
    : `${knownEnergyUse.toFixed(1)} MJ`
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-divider bg-content1 px-3 py-2 sm:px-4">
        <Button size="sm" color="primary" className="rounded-sm" onPress={onBuild} startContent={<Plus size={14} aria-hidden />}>
          Build
        </Button>
        <Button
          size="sm"
          variant={tool === 'select' && !pasteActive && !stationBuildActive ? 'solid' : 'flat'}
          color={tool === 'select' && !pasteActive && !stationBuildActive ? 'primary' : 'default'}
          onPress={onSelect}
          startContent={<Hand size={14} />}
          aria-pressed={tool === 'select' && !pasteActive && !stationBuildActive}
        >
          Select
        </Button>
        <Button size="sm" variant="flat" onPress={onAddNote} startContent={<StickyNote size={14} aria-hidden />}>
          Note
        </Button>
        <Button
          ref={productToggleRef}
          size="sm"
          variant="flat"
          isDisabled={!canChooseProduct}
          onPress={onProduct}
          startContent={<Package size={14} aria-hidden />}
        >
          Product
        </Button>
        <Button
          size="sm"
          variant="flat"
          isDisabled={!canConfigureOutputs}
          aria-haspopup="dialog"
          onPress={onOutputs}
          startContent={<Cable size={14} aria-hidden />}
        >
          Outputs
        </Button>
      </div>
      {storageIssue && (
        <p role="alert" className="border-b border-divider bg-content1 px-3 py-2 text-xs text-warning sm:px-4">
          {storageIssue === 'unavailable'
            ? 'Browser storage is unavailable or full. Changes stay in this tab until saving succeeds.'
            : storageIssue === 'conflict'
              ? 'Base changed in another tab. Changes here are not saved; reload to open the newer save.'
              : storageIssue === 'newer'
                ? 'This base was saved by a newer app version. Its save is preserved; update the app to reopen it.'
                : 'The saved base could not be read. Its data is preserved; changes in this tab cannot be saved.'}
        </p>
      )}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-divider bg-content1 px-3 py-1.5 sm:px-4">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span
            className="py-1 text-foreground/80 tabular-nums"
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
            className="py-1 text-foreground/80 tabular-nums"
            title={reactors ? 'Reactor generation is not present in the current game catalog' : 'No generators placed'}
          >
            Produced {reactors ? '— MJ' : '0 MJ'}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Tooltip content="Undo · Ctrl+Z">
            <Button isIconOnly size="sm" variant="light" aria-label="Undo" isDisabled={!commands.canUndo} onPress={commands.undo}>
              <Undo2 size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Redo · Ctrl+Y">
            <Button isIconOnly size="sm" variant="light" aria-label="Redo" isDisabled={!commands.canRedo} onPress={commands.redo}>
              <Redo2 size={16} />
            </Button>
          </Tooltip>
          <span className="mx-0.5 h-6 w-px bg-divider" aria-hidden />
          <Tooltip content="Copy · Ctrl+C">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Copy selected element"
              isDisabled={!commands.canCopy}
              onPress={commands.copy}
            >
              <Copy size={16} />
            </Button>
          </Tooltip>
          <Tooltip content={pasteDescription}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Paste copied element"
              aria-description={pasteDescription}
              aria-pressed={pasteActive}
              isDisabled={!commands.canPaste}
              onPress={commands.paste}
            >
              <ClipboardPaste size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Rotate · R">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Rotate preview or selected element"
              isDisabled={!commands.canRotate}
              onPress={commands.rotate}
            >
              <RotateCw size={16} />
            </Button>
          </Tooltip>
          <Tooltip content={deleteDescription}>
            <span
              className="inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
              role="group"
              tabIndex={!commands.canDelete ? 0 : undefined}
              aria-label="Delete and Cut"
              aria-description={deleteDescription}
            >
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                aria-label="Delete selected element"
                aria-description={deleteDescription}
                isDisabled={!commands.canDelete}
                onPress={commands.remove}
              >
                <Trash2 size={16} />
              </Button>
            </span>
          </Tooltip>
          <span className="mx-0.5 h-6 w-px bg-divider" aria-hidden />
          <Tooltip content="Zoom out">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Zoom out"
              isDisabled={!flow}
              onPress={() => void flow?.zoomOut({ duration: 0 })}
            >
              <ZoomOut size={16} aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip content="Zoom in">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Zoom in"
              isDisabled={!flow}
              onPress={() => void flow?.zoomIn({ duration: 0 })}
            >
              <ZoomIn size={16} aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip content="Fit layout">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Fit layout"
              isDisabled={!flow || !hasLayout}
              onPress={() => void flow?.fitView({ maxZoom: 1.15, padding: 0.2, duration: 0 })}
            >
              <Scan size={16} aria-hidden />
            </Button>
          </Tooltip>
        </div>
      </div>
    </>
  )
}
