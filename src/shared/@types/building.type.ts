export interface RecipeInput {
  id: string
  amount_per_minute: number
}

export interface RecipeOutput {
  id: string
  amount_per_minute: number
}

export interface Recipe {
  /** Stable source-derived recipe ID; optional only for isolated calculator fixtures. */
  id?: string
  output: RecipeOutput
  inputs: readonly RecipeInput[]
  /** Additional source-backed products of the same crafting operation. */
  extra_outputs?: readonly RecipeOutput[]
}

export interface RawBuilding {
  id: string
  name: string
  /** Source-backed power value. Missing means unknown; it is never normalized to zero. */
  power?: number
  type: string
  recipes?: readonly Recipe[]
}

/** Application model with an explicit recipe collection. */
export interface Building extends Omit<RawBuilding, 'recipes'> {
  recipes: readonly Recipe[]
}
