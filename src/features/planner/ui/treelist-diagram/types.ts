import type { ProductionStep } from '../../lib'

/** A branch of confirmed demand; coproduct leaves reference production elsewhere in the tree. */
export interface TreeNodeData extends Partial<ProductionStep> {
  itemId: string
  isRawMaterial?: boolean
  isFinalProduct?: boolean
  isSupply?: boolean
  /** Primary product identifying the real producer of this credited coproduct. */
  coproductSourceItemId?: string
  children?: TreeNodeData[]
}
