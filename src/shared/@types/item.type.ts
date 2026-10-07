/** Categorías que entiende la web; deben corresponder a los valores generados en items.json. */
export type ItemType = 'raw' | 'processed' | 'component'

/** Forma mínima del registro generado en items.json, antes de comprobar su categoría. */
export interface RawItem {
  id: string
  name: string
  type: string
}

/** Objeto que puede usar el resto de la aplicación tras pasar la frontera de datos. */
export interface Item extends Omit<RawItem, 'type'> {
  type: ItemType
}
