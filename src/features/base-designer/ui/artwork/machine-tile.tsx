import { Button, cn } from '@heroui/react'
import { itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import { Box, Package } from 'lucide-react'
import { memo, type CSSProperties } from 'react'
import { canAccessMachinePort, machinePortFlow, type CanTraverseEdge, type OccupiedCells } from '../../lib/connections/connections'
import type { BasePlacement } from '../../lib/layout/placement'
import { isProductMachine, recipeForPlaceable, recipeOutputs } from '../../lib/products/machine-recipes'
import { machinePortKey, machinePorts, portOutsideCell } from '../../lib/connections/ports'
import type { RouteAnchor } from '../../lib/routes/route'
import { MACHINE_BODY_INSET, portPosition } from '../../lib/geometry/station-spatial'
import { CELL_SIZE, PLACEABLES, type PlaceableType } from '../../model/catalog'
import { PortMarker } from './port-marker'

const machineMarkings: Partial<Record<PlaceableType, string>> = {
  reactor: 'REACTOR',
  refinery: 'REFINERY',
  assembler: 'ASSEMBLER',
  material_lab: 'MATERIAL LAB',
  container: 'BOX',
  enrichment: 'ENRICHMENT',
  computation_lab: 'COMPUTATION LAB',
}

/**
 * Paint machine products and I/O in the caller's cell frame; occupied/traversal must share that frame.
 * Body inset and product sizing never change the logical footprint. Product editing delegates through onOpenItem.
 * Incoming flow and outgoing permission stay independent, including the disabled marker on a connected input.
 */
export const MachineTile = memo(function MachineTile({
  occupied,
  placement,
  canTraverse,
  preview,
  valid = true,
  moving = false,
  routeable = false,
  hoveredPort,
  selected = false,
  interactive = false,
  onOpenItem,
}: {
  occupied: OccupiedCells
  placement: BasePlacement
  canTraverse?: CanTraverseEdge
  preview?: boolean
  valid?: boolean
  moving?: boolean
  routeable?: boolean
  hoveredPort?: RouteAnchor | null
  selected?: boolean
  interactive?: boolean
  onOpenItem?: (placementId: string) => void
}) {
  const info = PLACEABLES[placement.type]
  const compact = info.width <= 3
  const markerSize = Math.min(88, Math.min(info.width, info.height) * CELL_SIZE * 0.5)
  const storage = placement.type === 'container'
  const recipe = recipeForPlaceable(placement.type, placement.recipeId)
  const products = recipe ? recipeOutputs(recipe) : []
  const productNames = products.map((product) => itemNameById.get(product.id) ?? product.id).join(', ')
  const productSlots = Math.max(2, Math.floor((info.width * CELL_SIZE - MACHINE_BODY_INSET * 2 - 8) / (markerSize + 3)))
  const visibleProducts = products.slice(0, products.length > productSlots ? productSlots - 1 : productSlots)
  const hiddenProductCount = products.length - visibleProducts.length
  const machineStyle: CSSProperties & Record<'--base-machine-inset' | '--base-marker-size', string> = {
    left: placement.x * CELL_SIZE,
    top: placement.y * CELL_SIZE,
    width: info.width * CELL_SIZE,
    height: info.height * CELL_SIZE,
    '--base-machine-inset': `${MACHINE_BODY_INSET}px`,
    '--base-marker-size': `${markerSize}px`,
  }
  return (
    <div
      title={
        preview
          ? undefined
          : `${info.label} · ${placement.x + 1}, ${placement.y + 1} · ${info.width}×${info.height}${productNames ? ` · Produces ${productNames} · Right-click to clear product` : ''}`
      }
      className={cn(
        'base-placement base-placement--machine absolute',
        interactive ? 'nodrag pointer-events-auto cursor-move' : 'pointer-events-none',
        interactive && 'base-placement--interactive',
        compact && 'base-placement--compact',
        storage && 'base-placement--storage',
        preview && 'base-placement--preview',
        preview && !valid && 'base-placement--invalid',
        moving && 'base-placement--moving',
        selected && 'base-placement--selected-machine',
      )}
      style={machineStyle}
      onDragStart={(event) => event.preventDefault()}
    >
      <span className="base-machine-shell pointer-events-none absolute" aria-hidden>
        {products.length ? (
          <span className="base-machine-products absolute" aria-hidden>
            {visibleProducts.map((product, index) => (
              <span
                key={`${product.id}:${index}`}
                className={cn('base-machine-product', index === 0 && 'base-machine-product--primary')}
                title={`${index === 0 ? 'Primary product' : 'Co-product'}: ${itemNameById.get(product.id) ?? product.id}`}
              >
                <AssetImage kind="items" id={product.id} width={index === 0 ? markerSize : compact ? 12 : 22} alt="" />
              </span>
            ))}
            {hiddenProductCount ? (
              <span className="base-machine-product base-machine-product--count" title={`Products: ${productNames}`}>
                +{hiddenProductCount}
              </span>
            ) : null}
          </span>
        ) : storage ? (
          <Box className="base-storage-mark absolute" size={8} strokeWidth={2.5} />
        ) : null}
        {!products.length ? (
          <span className="base-machine-band absolute right-0 left-0">{machineMarkings[placement.type] ?? info.label}</span>
        ) : null}
      </span>
      {interactive && onOpenItem && isProductMachine(placement.type) && !products.length ? (
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          aria-label={`Choose product for ${info.label}`}
          title="Choose product"
          className="base-machine-item-button nodrag nopan absolute h-5 min-h-0 w-5 min-w-0 rounded-sm p-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onPress={() => onOpenItem(placement.id)}
        >
          <Package size={12} aria-hidden />
        </Button>
      ) : null}
      {machinePorts(placement)
        .filter((port) => !canTraverse || canAccessMachinePort(placement, port, canTraverse))
        .map((port) => {
          const flow = preview ? null : machinePortFlow(occupied, placement, port, canTraverse)
          const outputEnabled = !placement.disabledOutputPorts?.includes(machinePortKey(port))
          const portDescription = `${port.face} cell ${port.offset + 1} · ${flow === 'input' ? 'Input connected' : flow === 'output' ? 'Output connected' : flow === 'disabled-output' ? 'Output blocked' : 'No belt'} · Output ${outputEnabled ? 'enabled' : 'disabled'}; input stays available`
          const outside = portOutsideCell(placement, port)
          const portHovered =
            hoveredPort?.kind === 'port' && hoveredPort.x === outside.x && hoveredPort.y === outside.y && hoveredPort.face === port.face
          const position = portPosition(placement, port)
          return (
            <span key={`${port.face}-${port.offset}`} aria-hidden>
              {flow && flow !== 'disabled-output' ? (
                <span className="base-machine-port-bridge absolute" data-face={port.face} style={position} />
              ) : null}
              <PortMarker
                className={cn(
                  'base-machine-port absolute',
                  routeable && 'base-machine-port--routeable',
                  portHovered && 'base-machine-port--hovered',
                )}
                face={port.face}
                flow={flow ?? (outputEnabled ? 'unconnected' : 'disabled-output')}
                outputEnabled={outputEnabled}
                connected={Boolean(flow && flow !== 'disabled-output')}
                hovered={portHovered}
                title={portDescription}
                style={position}
              />
            </span>
          )
        })}
    </div>
  )
})
