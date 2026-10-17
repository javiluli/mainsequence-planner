# Pruebas

Vitest protege reglas de dominio, integridad de datos y regresiones de estado e interfaz. Las pruebas viven en `test/`, reflejando la propiedad de `src/`; sus fixtures e inspectores no entran en el runtime. Playwright cubre los gestos nativos que jsdom no puede comprobar.

## Contratos que deben conservarse

| Área                      | Protección mantenida                                                                                                                                                                                                                               | Referencias principales                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo e investigación  | IDs y referencias válidas, Crafter reales, ratios positivos, energía/costes desconocidos, cantidades de construcción y prerrequisitos completos.                                                                                                   | [Integridad del catálogo](test/shared/data/catalog-integrity.test.ts), [investigación](test/shared/data/research-catalog.test.ts).                                            |
| Planner                   | Demanda recursiva, ciclos y tasas inválidas, máquinas físicas, energía nominal, suministro compartido, variantes exactas, síntesis raw explícita, reciclaje, coproductos y costes. Árbol y grafo consumen el mismo plan sin duplicar presupuestos. | [Cálculos](test/features/planner/lib/production-plan/), [árbol](test/features/planner/ui/treelist-diagram/lib/tree-build.test.ts), [store](test/store/planner.store.test.ts). |
| Items, Recipes y Research | Filtros combinados, productores/coproductos, selección de receta real, ancestros y aristas de investigación, foco y navegación.                                                                                                                    | [Items](test/features/items/items-table.test.ts), [Recipes](test/features/recipes/recipe-output.test.tsx), [Research](test/features/research/).                               |
| UI compartida y rutas     | Carga y fallback de imágenes, recuperación de errores, movimiento reducido, cancelación de cargas y cierre/desmontaje sin efectos tardíos.                                                                                                         | [UI](test/shared/ui/), [reveal](test/features/planner/flow/diagram/diagram-reveal.test.tsx), [rutas](test/pages/route-error.test.tsx).                                        |

### Bases

La [matriz de reglas](src/features/base-designer/docs/reglas/README.md) define el contrato vigente. Las pruebas de dominio y store deben conservar:

- **Colocación y geometría:** huellas, suelo/corredores, ocupación superficial y enterrada, límites de enteros, negativos, prioridad de errores y validación de la escena final. [Colocación](test/features/base-designer/placement-validation.test.ts), [estaciones](test/features/base-designer/station-corridors.test.ts) y [apoyo de túneles](test/features/base-designer/tunnel-floor-support.test.ts).
- **Conexiones y niveles:** puertos físicos, roles fijos, T/codos y rechazo de X, dirección de una célula, cortes/fusiones, alcance de túneles, permisos y límites MK1/MK2. [Red](test/features/base-designer/belt-network.test.ts), [variantes](test/features/base-designer/logistics-variants.test.ts) y [topología del store](test/store/base-designer-belt-topology.test.ts).
- **Selección y gestos:** IDs explícitos, rutas completas, pivote estable, cuatro giros, clipboard conservado, pegado repetido, cancelación y capturas obsoletas. [Selección](test/features/base-designer/selection.test.ts), [transformaciones](test/features/base-designer/selection-transform.test.ts), [herramientas](test/features/base-designer/editor-tools.test.tsx) y [grupos](test/store/base-designer-groups.test.ts).
- **Transacciones e historial:** validar antes de asignar IDs, confirmar una sola vez, aislar arrays recibidos, conservar referencias no afectadas y no escribir ni crear undo ante rechazos/no-ops. [Elementos](test/store/base-designer-elements.test.ts), [transacciones](test/store/base-designer-transactions.test.ts) e [historial](test/store/base-designer-history.test.ts).
- **Producción:** recetas del catálogo, cuotas compartidas por proveedor/ingrediente, niveles mixtos, reparto y redistribución, causas desconocidas, ciclos, repetición sin mutar presupuestos y comparación nominal con Planner. [Análisis](test/features/base-designer/production-analysis.test.ts), [uniones directas](test/features/base-designer/direct-production.test.ts) y [comparación](test/features/base-designer/planner-comparison.test.ts).
- **Representación e interacción:** continuidad de curvas/sockets y fases, hover/preview estable, cámara con última propuesta, recuperación de originales ocultos, foco/atajos y región de estado. [Dibujo](test/features/base-designer/belt-drawing.test.ts), [cámara](test/features/base-designer/canvas-navigation.test.ts), [preview](test/features/base-designer/tool-preview.test.tsx), [canvas](test/features/base-designer/canvas-ui.test.tsx) y [tooltip/formato](test/features/base-designer/machine-hint.test.tsx).

[scene-fixture.ts](test/features/base-designer/scene-fixture.ts) comparte escenas válidas entre grupos, persistencia y E2E. La recepción del BOX se protege en [container-reception.test.ts](test/features/base-designer/container-reception.test.ts): tipos, suma por caras, tasas MK1/MK2, incertidumbre y presupuesto de productor compartido; reparto con recetas y tooltip conservan sus pruebas de análisis/interfaz. [performance-scene.ts](test/features/base-designer/performance-scene.ts) genera escenas representativas para validar y medir; las pruebas no imponen duraciones exactas. El [README de Bases](src/features/base-designer/README.md#rendimiento-y-perfilado) conserva el procedimiento de medición.

## Persistencia y compatibilidad

[base-designer-scene-storage.test.ts](test/store/base-designer-scene-storage.test.ts) construye documentos de entrada independientemente del escritor. Protege formatos 1–10, IDs, propietarios, rutas completas, sentido, variantes históricas, recetas, cargo, permisos y nombres guardados. Cada formato conserva sus restricciones; una versión insuficiente o un registro inválido rechaza el documento completo.

El almacenamiento controlado comprueba carga sin reescritura, acceso denegado, documentos corruptos/futuros intactos, cuota agotada, reintento y conflicto con otra sesión. La clave del editor anterior permanece intacta. Undo/Redo guarda sólo escenas confirmadas; recargar vacía historial y selección. Cambiar el modelo exige conversión y pruebas de conservación, sin reinicios silenciosos ni soporte indefinido de cada formato histórico.

## E2E de Bases

[playwright.config.ts](playwright.config.ts) usa Chromium fijado por Playwright, un worker, cero reintentos, movimiento reducido y un Vite propio en el puerto 4174. Cada prueba tiene contexto de navegador y almacenamiento desechables. CI instala ese Chromium y ejecuta la suite.

Los cinco flujos de [base-designer.e2e.ts](test/e2e/base-designer.e2e.ts) comprueban:

1. Catálogo, colocación/rechazo, asignación/retirada de receta, no-op y recarga con el diálogo real.
2. Selección por puntero/área, arrastre individual y múltiple, giro, copiar/cortar/pegar, cancelación y Undo/Redo.
3. Dibujo y prolongación de ruta conservando ID, splitter inline y conexión con el socket del túnel.
4. Búsqueda vacía, cargo independiente por slot, retirada/no-op, contexto de diálogos, campos protegidos, retorno de foco y catálogo/Production a 390 px.
5. Tooltip del BOX con todos sus ítems/tasas, retirada nativa de cinta, Undo, recarga, foco y límites del tooltip a 390 px.

Las acciones usan ratón/teclado sobre Konva y controles reales. Las aserciones leen el guardado mediante el validador servido por Vite, sin llamar al store. La regresión de callbacks HeroUI de cargo también se protege con [el diálogo real en jsdom](test/features/base-designer/drone-cargo-dialog.test.tsx). No duplicar matrices de dominio en E2E.

## Criterio y límites

Conservar pruebas críticas y de uso frecuente. Usar parametrización para comportamientos equivalentes y consolidar archivos por responsabilidad. Una matriz cartesiana repetida en varias capas puede sustituirse por integraciones representativas si el dominio conserva sus diferencias. Research verifica todas las referencias y la vista global, con cinco topologías de detalle representativas; el árbol comprueba cadenas, suministro, síntesis y reciclaje sin recorrer cada producto en cada vista.

No probar wrappers triviales, clases CSS, contadores privados de renderizados ni tiempos exactos de animación. Mantener teardown, cancelación, no-ops y fronteras de datos aunque sean casos específicos. No borrar una regresión útil para obtener un resultado verde o reducir el contador.

jsdom no demuestra pintura, posición visual final ni anuncios de un lector de pantalla. Playwright tampoco certifica todos los navegadores, dispositivos físicos, latencia, rendimiento de campo ni accesibilidad completa del canvas. Para cambios visibles, complementar el flujo afectado con comprobación de foco/teclado, narrow y movimiento reducido. Las mediciones de rendimiento deben comparar escenarios equivalentes.

## Ejecución

Usar Node de [.nvmrc](.nvmrc) y pnpm de [package.json](package.json). Antes de integrar código:

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

`pnpm build` incluye TypeScript completo; puede ejecutarse por separado con `pnpm exec tsc -b`. Para filtrar pruebas: `pnpm exec vitest run test/features/base-designer/`.

Para cambios de flujos del editor:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Los archivos `*.e2e.ts` no coinciden con el patrón de Vitest. Traces/capturas de fallos quedan en `test-results/`, ignorado por Git; inspeccionarlos con `pnpm exec playwright show-trace <archivo.trace.zip>`.

Para cambios exclusivamente documentales, comprobar exactitud, referencias y formato. `node scripts/check-architecture.mjs` es una herramienta local opcional, ajena a los requisitos de checkout y CI.
