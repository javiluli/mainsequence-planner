/** Ramas de ciencia presentes en research.json; `general` no aporta puntos y se trata aparte. */
export type ScienceTypeId =
  | 'alien_technology'
  | 'astronomy_science'
  | 'computation_science'
  | 'electromagnetic_science'
  | 'material_science'
  | 'quantum_science'
  | 'xenobiology_science'

/** ID estable y nombre visible de una rama de ciencia. */
export interface ResearchScienceType {
  id: ScienceTypeId
  name: string
}

/** Puntos que entrega una unidad de un objeto a una rama de ciencia. */
export interface ResearchItem {
  item_id: string
  type: ScienceTypeId
  points_per_item: number
}

/** Coste de una tecnología en una rama; una tecnología puede tener varios costes. */
export interface ResearchCost {
  type: ScienceTypeId
  points: number
}

/** El juego puede desbloquear recetas, máquinas u otros bloques. */
export type ResearchUnlockType = 'recipe' | 'buildable' | 'block'

export interface ResearchUnlock {
  type: ResearchUnlockType
  id: string
  name?: string
}

/** Tecnología unificada por ID a partir de sus apariciones en varias ramas del JSON. */
export interface ResearchTechnology {
  id: string
  name: string
  /** ID de la textura exportada para su icono. */
  icon?: string
  costs: readonly ResearchCost[]
  /** Solo este indicador confirma un desbloqueo inicial; un coste vacío no basta. */
  start_unlocked?: boolean
  /** El juego distingue el requisito principal de los adicionales; el grafo usa ambos. */
  primary_prerequisite?: string
  prerequisites?: readonly string[]
  unlocks: readonly ResearchUnlock[]
}
