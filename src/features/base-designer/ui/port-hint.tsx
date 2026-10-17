import { itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import { portsForSelection } from '../lib/output-ports'
import { recipeForBuilding } from '../lib/building-recipes'
import { portProductKey, type BeltNetwork, type ProductKnowledge } from '../lib/belt-network'
import type { BuildingPort } from '../model/buildings'
import type { Scene, Selection } from '../model/scene'

/** A port or machine-body entry, rather than every pointer frame, owns the lightweight HTML hint. */
export interface HoveredPort {
  owner: Selection
  key: string
  x: number
  y: number
}

const empty: ProductKnowledge = { items: [], unknown: false }

/** Disabled outputs still identify their configured product; incoming products remain inspectable independently. */
function portProducts(scene: Scene, network: BeltNetwork, owner: Selection, port: BuildingPort): ProductKnowledge {
  const receiving = network.portRoles.get(owner.id)?.[port.key] === 'input'
  const transported = network.portProducts.get(portProductKey(owner.id, port.key))
  if (transported && (receiving || port.outputEnabled !== false)) return transported
  if (owner.kind === 'building') {
    const building = scene.buildings.find((piece) => piece.id === owner.id),
      recipe = building && recipeForBuilding(building.type, building.recipeId)
    return recipe ? { items: [recipe.output.id, ...(recipe.extra_outputs ?? []).map((item) => item.id)], unknown: false } : empty
  }
  if ('itemId' in port && typeof port.itemId === 'string') return { items: [port.itemId], unknown: false }
  return network.cellProducts.get(`${port.cell.x - port.normal.x},${port.cell.y - port.normal.y}`) ?? empty
}

/** Products and output status only; F remains the existing contextual command, with no panels or dialog state. */
export function PortHint({ scene, network, hover }: { scene: Scene; network: BeltNetwork; hover: HoveredPort | null }) {
  if (!hover) return null
  let knowledge: ProductKnowledge = empty,
    enabled: boolean | undefined
  if (hover.owner.kind === 'belt') {
    const belt = scene.belts.find((piece) => piece.id === hover.owner.id),
      cell = hover.key === 'end-0' ? belt?.points[0] : belt?.points.at(-1)
    if (cell) knowledge = network.cellProducts.get(`${cell.x},${cell.y}`) ?? empty
  } else {
    const port = portsForSelection(scene, hover.owner).find((candidate) => candidate.key === hover.key)
    if (!port) return null
    knowledge = portProducts(scene, network, hover.owner, port)
    enabled = port.outputEnabled !== false
  }
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-48 space-y-2 rounded-md bg-content1 p-3 text-xs shadow-md"
      style={{ left: `clamp(8px, ${hover.x + 16}px, calc(100% - 204px))`, top: `clamp(8px, ${hover.y + 16}px, calc(100% - 150px))` }}
    >
      <div className="space-y-1">
        {knowledge.items.slice(0, 3).map((id) => (
          <div key={id} className="flex items-center gap-2">
            <AssetImage kind="items" id={id} width={18} alt="" />
            <span>{itemNameById.get(id) ?? id}</span>
          </div>
        ))}
        {knowledge.items.length > 3 && <p>{knowledge.items.length - 3} more items</p>}
        {knowledge.unknown && <p>Unknown item</p>}
        {!knowledge.items.length && !knowledge.unknown && <p>No item</p>}
      </div>
      {enabled !== undefined && <p className={enabled ? 'text-foreground-500' : 'text-danger'}>{enabled ? 'Enabled' : 'Disabled'}</p>}
    </div>
  )
}
