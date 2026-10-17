# Base Designer

Editor de bases con React Konva: estaciones, siete edificios, cintas/splitters/túneles MK1/MK2, cargos de dron, recetas, selección explícita, clipboard y Undo/Redo. Guarda una escena confirmada en este navegador. La variante histórica 2×2 B y los nombres ya guardados siguen admitidos, aunque sus controles se retiraron.

## Referencias

- [Uso y atajos](../../../README.md#-for-players).
- [Reglas del editor](docs/reglas/README.md): 91 reglas con IDs estables, excepciones, dueños y enlaces a la implementación. Distinguen comportamiento disponible de semántica aprobada pendiente.
- [Capacidades y decisiones pendientes](docs/ideas-pendientes.md): único inventario futuro; una casilla no autoriza implementación.
- [Contratos de pruebas](../../../TESTS.md) y [convenciones del proyecto](../../../AGENTS.md).
- [Catálogo fuente](../../shared/data/main-sequence/README.md).

## Responsabilidades

| Dueño                                                                                                          | Responsabilidad                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [model/](model/)                                                                                               | Escena en células de mundo, IDs/propiedad, huellas y puertas, puertos físicos y registros tipados de logística. Capacidad y alcance verificados pertenecen a `logistics.ts`; no inferirlos del sufijo del ID. |
| [stations.ts](lib/stations.ts), [placement.ts](lib/placement.ts), [belts.ts](lib/belts.ts)                     | Suelo/corredores derivados, ocupación, apoyo y conexión dirigida. Validar el escenario final conservando las diferencias entre superficie, bocas y tramo enterrado.                                           |
| [scene-geometry.ts](lib/scene-geometry.ts)                                                                     | Límites, traslación, pivote y giro puros. No valida ni asigna IDs; decoración y bounds visuales no cambian huellas lógicas.                                                                                   |
| [selection.ts](lib/selection.ts), [selection-transform.ts](lib/selection-transform.ts)                         | IDs explícitos, capturas vigentes, retirada y transformación completas. Conservar referencias no afectadas y resolver propiedad sobre el suelo final.                                                         |
| [clipboard.ts](lib/clipboard.ts), [clipboard-group.ts](lib/clipboard-group.ts)                                 | Capturas sin identidades reutilizables y propuestas de pegado. El grupo conserva geometría relativa y usa claves temporales sin colisión antes de asignar IDs reales.                                         |
| [belt-edits.ts](lib/belt-edits.ts)                                                                             | Cortes al insertar splitters y fusión de continuaciones compatibles, conservando nivel, sentido y rutas ajenas.                                                                                               |
| [building-recipes.ts](lib/building-recipes.ts), [output-ports.ts](lib/output-ports.ts)                         | Recetas exactas del Crafter y permisos por claves locales estables. Desactivar una salida no elimina la entrada de máquina ni el encaje físico.                                                               |
| [belt-network.ts](lib/belt-network.ts)                                                                         | Grafo dirigido, productos conocidos/desconocidos, capacidades y geometría compacta desde la escena confirmada. No persiste conexiones ni simula producción.                                                   |
| [production-analysis.ts](lib/production-analysis.ts), [production-allocation.ts](lib/production-allocation.ts) | Demandas, presupuestos compartidos, reparto nominal, incertidumbre y agregación. [planner-comparison.ts](lib/planner-comparison.ts) consume el plan recibido por la API pública, sin acoplar stores.          |
| [base-designer.store.ts](../../store/base-designer.store.ts)                                                   | Única frontera de confirmación: revalidar, asignar IDs tras aceptación y registrar un commit con todas sus consecuencias. Historial de sesión hasta 100 operaciones, con snapshots inmutables compartidos.    |
| [scene-document.ts](lib/scene-document.ts), [persistence.ts](../../store/base-designer/persistence.ts)         | Validación de datos desconocidos, compatibilidad de formatos y guardado de colecciones confirmadas. Proteger documentos ilegibles o modificados por otra sesión.                                              |
| [use-editor-tools.ts](ui/tools/use-editor-tools.ts), [tool-drafts.ts](lib/tool-drafts.ts)                      | El hook posee herramienta, selección, clipboard y anclas; el módulo puro propone coordenadas, codos, dirección y túneles para preview y clic.                                                                 |
| [base-designer.tsx](ui/base-designer.tsx), [editor-canvas.tsx](ui/canvas/editor-canvas.tsx)                    | Composición, diálogos/foco y arbitraje de gestos. Cámara, rectángulo y portador de arrastre tienen dueños en [ui/canvas/](ui/canvas/); las figuras viven en [ui/elements/](ui/elements/).                     |

## Contratos de edición

Los gestos producen propuestas. El store valida contra la escena vigente y acepta todo o nada; cancelación, destino inválido, captura obsoleta y no-op no consumen IDs ni añaden historial. Colocar un splitter y cortar su cinta forman una única operación.

Selección y contexto de edición son independientes. Operar sobre una estación no añade contenidos ni vecinos implícitos. Cintas y túneles se copian, mueven, giran y retiran completos; los edificios conservan propiedad explícita. Retirar o transformar suelo exige incluir cualquier pieza que perdería apoyo, también sobre corredores. Una estación vacía para captura individual usa un criterio conservador distinto de la validación final; el clipboard puede recurrir a captura de grupo.

Cada edificio debe caber en una estación ordinaria. Los túneles requieren bocas apoyadas en suelos de la misma red de corredores, aunque su parte enterrada salte vacío; las bocas nunca se editan por separado. Un giro conserva células enteras y su pivote entre repeticiones. Las restricciones concretas están en la matriz, incluidas T/codos, cruces, límites de túneles y variantes.

Cancelar gestos antes de cambiar herramienta, diálogo o historial. El portador de arrastre oculta originales confirmados y los restaura al cancelar/rechazar. El clipboard sobrevive a Escape, rechazo y Undo/Redo; el historial no rebobina estado de UI.

## Producción y catálogo

Refinery, Assembler y Enrichment se corresponden con los Crafter reales `refinery`, `fabricator` y `enrichment`. Container recibe los tipos de ítem de sus entradas y muestra sus tasas nominales compartidas con los demás destinos. Suma cada tipo entre caras sin imponer capacidad de almacenamiento; no simula inventario ni reenvía entre caras. Sus salidas conservan el fallback de proveedor desconocido. Reactor y laboratorios mantienen geometría y semántica futura separada. No inventar recetas, capacidades, energía o tasas de drones para completar datos.

Las cantidades son items/min y la energía nominal del catálogo usa MJ. MK1 limita a 60/min y MK2 a 120/min. Un productor comparte su presupuesto entre todas sus salidas; un ingrediente comparte demanda entre todas sus entradas. Los splitters reparten equitativamente y redistribuyen límites libres/saturados. Máquinas incompletas o incompatibles liberan sus cuotas; conexiones completas con suministro parcial siguen participando. Mezclas, ciclos y dependencias aguas arriba sin abastecer conservan incertidumbre. Se mantienen cuotas aceptadas, sin maximización global ni simulación temporal.

Production muestra estimación de toda la base, capacidad nominal secundaria e ingredientes suministrados/necesarios/faltantes. El LED del Container es verde con recepción calculable, ámbar sin recepción y gris ante suministro indeterminado; su tooltip enumera los ítems y tasas entrantes, conservando tipos conocidos y avisando de proveedores no identificados. Los demás LEDs y tooltips explican la máquina individual; sólo una cantidad insuficiente tiñe su cuerpo. La comparación con Planner usa requisitos nominales, suministro externo y coproductos acreditados una vez. Ninguna de estas cifras certifica transporte efectivo ni producción real.

La [imagen de ejemplo](docs/examples/chromatic-alloy.png) ilustra una base de Chromatic Alloy y Lightweight Frames; no certifica que sus dependencias cuantitativas estén completamente abastecidas.

## Persistencia

`mainsequence-base-scene` guarda sólo la escena confirmada. Selección, cámara, clipboard, previews, diálogos e historial son de sesión. Recargar restaura el plano y vacía historial/selección; navegar dentro de la aplicación conserva el store.

[readSceneDocument](lib/scene-document.ts) admite formatos 1–10 y conserva sus restricciones históricas. Valida globalmente IDs, registros, recetas/permisos y colocación; normaliza colecciones ausentes y MK1 implícito sin inventar asignaciones. El escritor declara el mínimo formato necesario: 3 ordinario, 4 dirección corta, 5 logística, 6 drones, 7 catálogo extendido/nivel, 8 receta, 9 permisos y 10 nombres. No reescribe al cargar.

Datos corruptos/futuros, acceso denegado y conflictos bloquean sobrescritura. Un fallo de escritura conserva memoria y documento anterior, permitiendo reintentar sin crear historial; mantener la página abierta mientras queden cambios sin guardar. La comparación previa al guardado protege cambios externos, pero no es un bloqueo atómico: usar una sola pestaña de edición.

`mainsequence-base-layout`, incluidos sus planos/notas ilegibles, permanece intacto. No existe conversión automática desde React Flow. Su implementación/documentación/tests originales están en `34de597061bfa96308c85af0a60d8368fb81c1f5`; consultarlos con `git show`, sin cambiar de rama. `createBaseDesignerStore()` sin adaptador crea stores efímeros para pruebas.

## Canvas y representación

Stage posee la cámara en píxeles; React observa el zoom mostrado. [use-camera-pan.ts](ui/canvas/use-camera-pan.ts) conserva sólo la última posición pendiente y la aplica antes de pintar el suelo; soltar drena y cancelar descarta. [viewport.ts](ui/canvas/viewport.ts) prepara bounds confirmados y cambia sólo transiciones de visibilidad. Ocultar no desmonta nodos ni elimina su coste de transformación.

Se conservan cuatro Layers: suelo/cuadrícula, estructura de cintas, travesaños y objetos/previews. Sólo los travesaños mantienen animación sin hit detection, con un reloj compartido que respeta movimiento reducido. Arte de suelo/dron, superficies e I/O se comparten; no hay bitmap por pieza ni canvas permanente por tarjeta. Miniaturas temporales reutilizan las figuras del editor.

[belt-drawing.ts](ui/elements/belt-drawing.ts) prepara conexiones, contornos y puentes; [belt.tsx](ui/elements/belt.tsx) conserva sus límites de memoización, capas y reloj. [belt-geometry.ts](ui/elements/belt-geometry.ts) y [port-geometry.ts](ui/elements/port-geometry.ts) explican curvas, fase y sockets en el código. Sus medidas visuales nunca modifican la huella lógica.

Previews reutilizan figuras estáticas y validan al cambiar célula/puerto, herramienta o escena, sin persistir gestos ni recalcular análisis confirmado por movimiento del puntero. El portador de un conjunto no usa el descarte por viewport de la escena confirmada. Los tooltips cambian contenido por identidad; su posición sigue coordenadas CSS sin rerender por movimiento.

## Rendimiento y perfilado

Las [pausas medidas de selecciones grandes](docs/ideas-pendientes.md#rendimiento-pendiente) siguen abiertas. Para evaluar una mejora, reutilizar [performance-scene.ts](../../../test/features/base-designer/performance-scene.ts): 3/25/100 módulos corresponden a 12/100/400 máquinas. Validar las escenas con los mismos contratos antes de medir. No imponer tiempos exactos en CI ni añadir caches por intuición.

Si está disponible, el profiler local opcional compara operaciones de dominio de dos snapshots; no forma parte de checkout/CI:

```sh
node scripts/profile-base-designer.mjs before 7
# Aplicar el cambio que se quiere medir, sin volver a generar before.
node scripts/profile-base-designer.mjs after 7
node scripts/profile-base-designer.mjs compare 7
```

Los bundles/JSON quedan en `node_modules/.cache/base-designer-profile/`. Preparación y carga quedan fuera del cronómetro; la comprobación del resultado debe incluirse igual en ambas versiones. Comparar mediana y dispersión con mismo equipo, fixtures, calentamiento y carga concurrente.

Para navegador, generar un documento de la fixture y servir un build de producción:

```sh
node --input-type=module -e "import { performanceScene } from './test/features/base-designer/performance-scene.ts'; import { mkdirSync, writeFileSync } from 'node:fs'; mkdirSync('node_modules/.cache', { recursive: true }); writeFileSync('node_modules/.cache/bases-400.json', JSON.stringify({ version: 10, scene: performanceScene(100) }));"
pnpm build
pnpm preview --host 127.0.0.1 --port 4175
```

Usar un perfil desechable en `/bases`; cargar el JSON únicamente en el almacenamiento de ese perfil:

```js
const input = document.createElement('input')
input.type = 'file'
input.onchange = async () => {
  localStorage.setItem('mainsequence-base-scene', await input.files[0].text())
  location.reload()
}
input.click()
```

Mantener viewport, zoom, DPR, movimiento y throttling equivalentes. C centra al 100 %; Ctrl/Cmd+A y R/flechas ejercitan conjuntos. Deshacer entre muestras; para pegado, copiar/cortar y pegar en vacío, deshaciendo ambos cambios. Calentar y recoger al menos siete muestras de validación, montaje, evento→resultado, pan y zoom; repetir cámara al 25 % y movimiento reducido. Separar muestras sin tracing de perfiles instrumentados, que añaden coste.

Registrar Long Tasks, commits y dibujo de cada capa sin sumar slices anidados. Intervalos entre callbacks no son FPS presentados, INP ni latencia física. Para memoria, comparar retenedores tras series equivalentes/GC, conservando historial y clipboard; el heap JS no mide RAM total o VRAM. Aceleración disponible no demuestra utilización GPU: medirla por separado en el equipo del usuario.

## Compatibilidad y extensión

La edición prioriza puntero de escritorio; controles conservan teclado/foco, narrow y movimiento reducido donde corresponde. El canvas no ofrece edición completa por teclado/touch ni accesibilidad completa para lectores de pantalla. Las comprobaciones mantenidas y sus límites están en TESTS.md.

`react-konva@19.2.7` permanece fijado por su contrato con React 19.2. Mantener HeroUI v2 y Tailwind v4. Para cambiar reglas, localizar primero su ID y dueño, seguir selección/clipboard/rutas/producción/persistencia afectados y actualizar código, pruebas y matriz juntos. El inventario pendiente no autoriza tutoriales ni nuevas funciones durante mantenimiento.
