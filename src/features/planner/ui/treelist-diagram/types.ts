import type { ProductionStep } from '../../lib'

export interface TreeNodeData extends Partial<ProductionStep> {
  itemId: string
  isRawMaterial?: boolean
  isFinalProduct?: boolean
  isSupply?: boolean
  children?: TreeNodeData[]
}
