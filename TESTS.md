# Inventario de pruebas

El repositorio conserva 25 archivos de pruebas con Vitest en `test/`, organizados según las áreas de `src/`. Los comprobadores de integridad `catalog-integrity.ts` y `research-integrity.ts` también están en `test/shared/data/`; son auxiliares de las pruebas, no datos de ejecución. No hay una suite E2E de navegador. Este inventario describe la cobertura prevista.

## Prioridad 1 — datos del juego y cálculos del planner

| Archivo de prueba                                                         | Qué cubre                                                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `test/shared/data/main-sequence/catalog-source.test.ts`                   | Objetos respaldados por los datos del juego, las ocho máquinas reales, ratios de recetas, cobertura del Códice y ramas de investigación. |
| `test/shared/data/catalog-integrity.test.ts`                              | Referencias a objetos existentes, IDs únicos y ratios válidos; distinción entre entradas externas y Biomasa como coproducto.             |
| `test/shared/data/research-catalog.test.ts`                               | Objetos que aportan puntos de ciencia, costes combinados de las ramas, desbloqueo de recetas y referencias de investigación.             |
| `test/features/research/graph/lib/research-graph.test.ts`                 | Conexiones entre requisitos previos, árboles completos y locales, espaciado del grafo y contexto de búsqueda.                            |
| `test/features/planner/lib/production-plan/main-sequence-catalog.test.ts` | Recetas y máquinas reales, energía, materias primas, fuentes ausentes, Biomasa y cadenas de producción conectadas.                       |
| `test/features/planner/lib/production-plan/build-production-plan.test.ts` | Ratios recursivos, totales de máquinas, suministro externo, objetivos de materias primas y energía desconocida.                          |
| `test/features/planner/lib/production-plan/plan-diagnostics.test.ts`      | Ciclos, entradas externas sin receta, ratios inválidos y cálculos de autorreciclaje.                                                     |
| `test/features/planner/lib/production-plan/recipe-selection.test.ts`      | IDs estables de recetas alternativas, insumos y máquinas elegidos, y selecciones obsoletas.                                              |
| `test/features/planner/lib/production-plan/recipe-yields.test.ts`         | Rendimiento neto del reciclaje y subproductos respaldados por el juego, incluida la Biomasa.                                             |
| `test/features/planner/lib/production-plan/byproduct-ledger.test.ts`      | Reparto de coproductos entre consumidores sin contarlos dos veces ni inventar una fuente inicial.                                        |
| `test/features/planner/lib/production-plan/supply-rate.test.ts`           | Entrega externa continua, demanda parcial y reparto de suministro compartido.                                                            |
| `test/features/planner/flow/plan-to-flow.test.ts`                         | Grafos de red y de etapas conectados y sin solapamientos; los planes con tasas inválidas no se presentan como válidos.                   |

## Prioridad 2 — flujos de usuario y presentación

| Archivo de prueba                                                  | Qué cubre                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `test/store/planner.store.test.ts`                                 | Estado de objetivos y ratios de suministro, incluida la recuperación de ratios antiguos.            |
| `test/store/planner-recipe-persistence.test.ts`                    | Persistencia de la receta elegida y recuperación de datos guardados con formatos anteriores.        |
| `test/features/research/lib/research-requirements.test.ts`         | Requisitos para desbloquear recetas y búsqueda de investigaciones previas.                          |
| `test/features/planner/flow/recycling-flow.test.ts`                | Ausencia de conexiones consigo mismo o nodos duplicados al representar reciclaje en React Flow.     |
| `test/features/planner/ui/treelist-diagram/lib/tree-build.test.ts` | Jerarquía de producción y consumo único del suministro compartido.                                  |
| `test/features/planner/flow/diagram/diagram-reveal.test.tsx`       | Animación de carga limitada al diagrama y aparición inmediata de las vistas preparadas.             |
| `test/features/planner/hooks/use-planner-result-reveal.test.tsx`   | Tiempo mínimo de carga, preparación diferida y tiempos de animación con movimiento reducido.        |
| `test/features/planner/flow/interaction/flow-neighborhood.test.ts` | Resaltado de conexiones anteriores y posteriores a un paso, y restablecimiento del foco.            |
| `test/shared/ui/asset-image/asset-image.test.tsx`                  | Asociación de iconos por ID del juego, dimensiones, carga y accesibilidad de la imagen alternativa. |
| `test/features/items/lib/build-items-table-rows.test.ts`           | Máquinas productoras, coproductos y datos de investigación en la vista de objetos.                  |

## Prioridad 3 — comportamientos concretos

| Archivo de prueba                                                | Qué cubre                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `test/features/items/filter-items.test.ts`                       | Combinación de filtros por categoría, máquina y texto.                       |
| `test/features/planner/flow/nodes/production-node-card.test.tsx` | Producción necesaria frente a nominal, sin sugerir que la máquina se regula. |
| `test/pages/route-error.test.tsx`                                | Estados de recuperación distintos para errores 404 y errores inesperados.    |

En la limpieza anterior se eliminaron nueve archivos de pruebas muy específicas porque otras pruebas ya cubrían esos comportamientos. En esta iteración se retiraron dos pruebas de la vista parcial obsoleta; los casos de entrada externa sin receta siguen cubiertos por los tests del plan y del grafo.
