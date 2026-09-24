export type ScienceTypeId =
  | 'alien_technology'
  | 'astronomy_science'
  | 'computation_science'
  | 'electromagnetic_science'
  | 'material_science'
  | 'quantum_science'
  | 'xenobiology_science'

export interface ResearchScienceType {
  id: ScienceTypeId
  name: string
}

export interface ResearchItem {
  item_id: string
  type: ScienceTypeId
  points_per_item: number
}

export interface ResearchCost {
  type: ScienceTypeId
  points: number
}

export type ResearchUnlockType = 'recipe' | 'buildable' | 'block'

export interface ResearchUnlock {
  type: ResearchUnlockType
  id: string
  name?: string
  hidden?: boolean
}

export interface ResearchTechnology {
  id: string
  name: string
  /** Source texture ID from the research technology asset. */
  icon?: string
  costs: readonly ResearchCost[]
  /** Only explicitly marked technologies start unlocked; an empty cost alone is not proof. */
  start_unlocked?: boolean
  /** Source demo restriction; not automatically applied to the current game version. */
  locked_in_demo?: boolean
  primary_prerequisite?: string
  prerequisites?: readonly string[]
  unlocks: readonly ResearchUnlock[]
}
