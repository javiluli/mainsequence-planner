/** Cantidad de entrada expresada por minuto; el generador convierte el tiempo de receta del juego. */
export interface RecipeInput {
  id: string
  amount_per_minute: number
}

/** Cantidad de salida expresada por minuto, en la misma unidad que las entradas. */
export interface RecipeOutput {
  id: string
  amount_per_minute: number
}

/** Una operación de una máquina, no una relación inferida desde el objeto producido. */
export interface Recipe {
  /** ID estable del juego; opcional únicamente para los ejemplos aislados de las pruebas. */
  id?: string
  output: RecipeOutput
  inputs: readonly RecipeInput[]
  /** Subproductos de la misma operación; no son recetas independientes. */
  extra_outputs?: readonly RecipeOutput[]
}

/** Material necesario para construir una única máquina. */
export interface ConstructionCost {
  id: string
  amount: number
}

/** Registro generado desde un Crafter. Solo incluye valores que estén respaldados por los datos disponibles. */
export interface RawBuilding {
  id: string
  name: string
  /** MJ nominales del juego; ausente significa desconocido, no cero. */
  power?: number
  type: string
  /** Materiales necesarios para construir una máquina; ausente significa que el coste todavía no se conoce. */
  construction_cost?: readonly ConstructionCost[]
  /** El generador actual siempre la incluye; la frontera admite su ausencia sin inventar recetas. */
  recipes?: readonly Recipe[]
}

/** Máquina lista para consultas: recipes siempre es una lista, aunque esté vacía. */
export interface Building extends Omit<RawBuilding, 'recipes'> {
  recipes: readonly Recipe[]
}
