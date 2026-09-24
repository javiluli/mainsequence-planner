import type { ProductionStep } from '../../../lib'
import type { TreeNodeData } from '../types'

type SupplyMap = Map<string, number>

const buildNodeData = (step: ProductionStep, targetIpm: number): TreeNodeData => {
  const recipeOutputIpm = step.recipeOutputIpm || 1
  const buildingLoad = targetIpm / recipeOutputIpm
  const buildingCount = Math.ceil(buildingLoad)

  return {
    ...step,
    targetIpm,
    buildingLoad,
    buildingCount,
  }
}

const buildSupplyNode = (itemId: string, supplyIpm: number): TreeNodeData => ({
  itemId,
  targetIpm: supplyIpm,
  supplyCount: supplyIpm,
  isSupply: true,
  buildingName: 'Supply',
  children: [],
})

const getSupplyRemainingMap = (stepsByItem: Map<string, ProductionStep>) => {
  const map: SupplyMap = new Map()
  stepsByItem.forEach((step, itemId) => {
    map.set(itemId, step.supplyCount ?? 0)
  })
  return map
}

/**
 * Consume supply disponible para un item y devuelve lo usado/restante.
 * Mantiene el map actualizado para no reutilizar supply en otras ramas.
 */
const applySupply = (supplyRemaining: SupplyMap, itemId: string, demand: number) => {
  const available = supplyRemaining.get(itemId) ?? 0
  const used = Math.min(available, demand)
  const remaining = Math.max(demand - used, 0)

  if (used > 0) supplyRemaining.set(itemId, available - used)

  return { used, remaining }
}

/**
 * Genera hijos para un input: primero el supply (si existe) y luego la produccion
 * restante si la demanda no queda cubierta.
 */
const buildInputChildren = (
  input: ProductionStep['inputs'][number],
  targetIpm: number,
  recipeOutputIpm: number,
  stepsByItem: Map<string, ProductionStep>,
  supplyRemaining: SupplyMap,
) => {
  const inputTarget = (input.amount_per_minute / recipeOutputIpm) * targetIpm
  const { used: supplyUsed, remaining } = applySupply(supplyRemaining, input.id, inputTarget)

  const children: Array<TreeNodeData | null> = []
  if (supplyUsed > 0) children.push(buildSupplyNode(input.id, supplyUsed))
  if (remaining > 0) children.push(buildTree(stepsByItem, input.id, false, remaining, supplyRemaining))

  return children
}

/**
 * Resuelve todos los inputs de un paso usando supply compartido entre ramas.
 */
const buildChildren = (step: ProductionStep, targetIpm: number, stepsByItem: Map<string, ProductionStep>, supplyRemaining: SupplyMap) => {
  const recipeOutputIpm = step.recipeOutputIpm || 1

  return (step.inputs || [])
    .flatMap((input) => buildInputChildren(input, targetIpm, recipeOutputIpm, stepsByItem, supplyRemaining))
    .filter((child): child is TreeNodeData => Boolean(child))
}

/**
 * Transforma la lista plana en estructura de arbol usando un map.
 * Si isRoot es true, crea un nodo superior que representa el item resultante.
 */
export const buildTree = (
  stepsByItem: Map<string, ProductionStep>,
  currentId: string,
  isRoot = false,
  targetOverride?: number,
  supplyRemaining?: SupplyMap,
): TreeNodeData | null => {
  const step = stepsByItem.get(currentId)

  if (isRoot && step) {
    const rootTarget = targetOverride ?? step.targetIpm
    const rootChild = buildTree(stepsByItem, currentId, false, rootTarget, supplyRemaining)

    return {
      itemId: step.itemId,
      targetIpm: rootTarget,
      buildingName: step.buildingName,
      isFinalProduct: true,
      children: rootChild ? [rootChild] : [],
    }
  }

  if (!step) {
    return { itemId: currentId, targetIpm: targetOverride, isRawMaterial: true, children: [] }
  }

  const effectiveTarget = targetOverride ?? step.targetIpm
  if (effectiveTarget <= 0) return null

  const supplyMap = supplyRemaining ?? getSupplyRemainingMap(stepsByItem)
  const node = buildNodeData(step, effectiveTarget)

  return {
    ...node,
    children: buildChildren(step, effectiveTarget, stepsByItem, supplyMap),
  }
}
