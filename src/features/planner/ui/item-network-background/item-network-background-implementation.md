# Item Network Background — Auditoría e implementación

Fecha: 2026-09-30. Rama: `prueba-componente`.

## Alcance y evidencia

Bases queda pausado. El trabajo acumulado se guardó en `5bc0e5d` (`feat: checkpoint planner and bases designer work`), en `feat/seo-indexing`, antes de cambiar de rama. No se ha trasladado ese trabajo a `prueba-componente`.

Se leyeron todos los archivos originales del componente, su contexto y la petición de auditoría, además de sus consumidores, estilos, hook de selección, catálogo, iconos, theme, dependencias y configuración de TypeScript, Vite y ESLint.

El historial disponible contiene:

- `148ef01`: primera integración del fondo Canvas y sustitución del Marquee en el Planner.
- `2124a81`: segunda iteración Canvas, con capas de impacto prolongadas a 3.6 s.
- `9369849`: incorporación de la petición de auditoría.

No hay un commit de la implementación con tsParticles en el historial consultado. Tampoco se puede certificar mediante Git cuál fue la última versión visualmente correcta: las dos versiones Canvas registradas ya contienen la selección de un solo impacto por receptor. Se han utilizado como referencia de aspecto y movimiento, no como una versión estable demostrada.

## Problemas encontrados y cambios

### Impactos simultáneos y sincronización

El renderer calculaba impactos desde la fase temporal de cada enlace y construía un Map por receptor, conservando solamente el impacto más fuerte. Una llegada nueva podía ocultar otra; al desaparecer el enlace desaparecía también su impacto. Además, el ángulo se recalculaba con la posición actual del emisor.

Ahora `NetworkAnimation` mantiene viajes y eventos de contacto. Cada llegada crea un impacto con ID, receptor, ángulo congelado, inicio, duración e intensidad propios. No existe selección de un ganador por nodo: se dibujan todos los impactos activos. Sólo caducan al agotar su duración o al desaparecer su receptor; no al perder su enlace.

El cuerpo del nodo, los extremos de la señal y el contacto utilizan la misma función de radio visual, incluido el aumento por hover. Antes, la señal podía terminar dentro del radio visible al resaltar un nodo.

Se conserva la referencia de 3.6 s de la auditoría: flash de 90 ms, settle de 270 ms, hold de 900 ms y decay de 2.34 s. Glint, punto de contacto y limbo tienen finales progresivos anteriores al final de la corona. Las capturas de la revisión de rendimiento muestran las capas; no sustituyen la revisión de todos los casos de impactos simultáneos y desaparición de enlaces.

### Ciclo de vida y resize

El bucle anterior seguía solicitando frames con movimiento reducido y no suspendía su trabajo al salir del viewport. Las medidas pequeñas tampoco adaptaban las posiciones: varios cambios consecutivos inferiores al umbral podían acumular una desalineación.

Ahora hay un único RAF, suspendido con foco de teclado, movimiento reducido, pestaña oculta, tamaño cero o superficie fuera del viewport. El reloj sólo avanza durante frames activos; volver no reproduce el tiempo transcurrido fuera de pantalla.

Cada cambio real de medida adapta proporcionalmente los nodos existentes sin cambiar sus identidades, seeds ni imágenes. Canvas modifica su backing store inmediatamente antes del dibujo y limita el DPR a 2. El primer montaje combina medida en layout, hasta tres reintentos si el contenedor mide cero y un ResizeObserver para cambios posteriores.

En modo estático, un resize resuelve población y conexiones una sola vez. Cargar una imagen, cambiar el theme o interactuar puede solicitar un dibujo, sin mantener un bucle permanente. El cleanup libera RAF, observadores, listeners, callbacks de imágenes y referencias de interacción.

### Integración y accesibilidad

Se mantiene `usePlannerTarget().selectTargetItem` como única vía de selección. Un toque/click corto selecciona; un gesto de desplazamiento no se interpreta como click. No se modifican las recetas ni los JSON del catálogo.

La anterior sustitución del Marquee eliminó sus botones por item sin añadir una alternativa de teclado al Canvas. Ahora el fondo tiene una sola parada de foco, instrucciones accesibles, recorrido con flechas/Home/End y selección con Enter/Espacio. El nombre activo se anuncia y la animación se detiene mientras se navega por teclado. Por petición del usuario se retiró por completo el modo de pausa manual, incluido su botón, estado, imports y ramas de control.

El componente se carga de forma diferida solamente en el estado vacío. El texto central y la toolbar no dependen de que termine de cargar. Se retiraron los archivos del Marquee sin consumidores tras comprobar sus referencias; siguen recuperables en Git.

La primera integración también había eliminado estilos que aún utilizan `DiagramReveal` y `PlannerDiagramLoading`. Se restituyeron sus fases de visibilidad y transiciones, con una salida explícita para movimiento reducido. Se eliminó un import de tipo `Building` sin uso que impedía la compilación de esta rama; no cambia el contrato de datos.

## Arquitectura final

La raíz conserva únicamente API, componente, configuración y contratos. La segunda reorganización separa el montaje React del runtime y divide el motor y el dibujo por responsabilidad:

| Ubicación                               | Responsabilidad                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `index.ts`                              | API pública estable, consumida por la carga diferida del Planner                                    |
| `item-network-background.tsx`           | Canvas, instrucciones y estado accesibles; 33 líneas frente a 343                                   |
| `hooks/`                                | Montaje/cleanup y preferencia de movimiento; handlers de puntero y teclado                          |
| `runtime/`                              | RAF y reloj activo; observadores, tamaño/DPR/theme y caché de iconos                                |
| `simulation/`                           | Coordinador de 123 líneas frente a 663; población, fuerzas e integración y topología independientes |
| `animation/`                            | Viajes, contactos independientes y envolventes de intensidad del eclipse                            |
| `rendering/`                            | Orden de capas, enlaces, cuerpos, señal/estela, impactos y caché de rasterización                   |
| `lib/`                                  | Geometría y easing; radio visual común; tokens CSS y colores derivados                              |
| `network.config.ts`, `network.types.ts` | Parámetros y contratos compartidos                                                                  |

Hay 24 archivos de código; el mayor tiene 229 líneas. El motor no dibuja, el renderer no calcula física y la animación no depende de React. No se añaden componentes DOM por nodo, barrels privados ni una librería de managers. El orden de integración, IDs, semillas, densidad y contratos públicos se conservan.

### Archivos creados y retirados

La primera separación creó API, componente, animación, helpers y efectos. La segunda trasladó esas responsabilidades a `hooks/`, `runtime/`, `simulation/`, `animation/`, `rendering/` y `lib/`, dividiendo los archivos grandes y retirando los módulos planos sustituidos. El contexto técnico documenta cada archivo vigente. Este informe conserva el alcance y las evidencias, no una segunda configuración editable.

Retirados: el antiguo `item-network-background/index.tsx`, `random-item-marquee.tsx`, `marquee/index.tsx`, `marquee/styles.css` y `lib/random-items.ts`. Se retiran únicamente los estilos globales de movimiento reducido que pertenecían al Marquee.

## Rendimiento y límites

- Sin estado React a 60 FPS, consultas de theme dentro del frame ni recreación del motor durante resize.
- Imágenes reutilizadas por ID; carga y error invalidan también la superficie estática.
- Arcos y sombras prerenderizados en una caché LRU limitada a 64 superficies pequeñas reutilizadas; máscara compartida y recursos liberados en cleanup.
- Colores derivados cacheados; sin Map de impactos reconstruido cada frame.
- Culling de nodos, enlaces e impactos; retirada de save/restore innecesarios en los cuerpos de nodos.
- Distancia al cuadrado para descartar pares antes de calcular raíces o candidatos.
- Topología revisada cada 0.13 s, con histéresis y grados limitados. Se mantiene el intervalo original.
- Población acotada de 26–94 nodos, con incorporación/retirada gradual en modo animado.

La repulsión y búsqueda de vecinos siguen siendo O(n²); las estelas usan un gradiente cuya geometría cambia. No se reduce la población, se suprimen impactos ni se añade WebGL para encubrir el coste. Un índice espacial u otro renderer deben responder a evidencia de un cuello de botella distinto, no a la mera presencia de dos bucles.

### Ralentización sostenida: causa demostrada

La revisión posterior fue autorizada expresamente en navegador y utilizó una compilación de producción. A 1920×1080, DPR 2, los impactos acumulados generaban más de 1.400 trazos desenfocados por frame. Tras el arranque, se registraron aproximadamente 3–6 FPS y p95 de intervalos de frame de 292–451 ms, aunque la ejecución JavaScript solía durar 2–4 ms.

Una intervención diagnóstica que retiró únicamente el desenfoque del Canvas principal elevó la frecuencia a unos 139 FPS. No se retiraron nodos, señales ni física. Esto identifica el trabajo de rasterización de sombras como el cuello principal; no demuestra una fuga de memoria ni un problema específico del driver GPU.

La primera mejora agrupó cada arco en una imagen: a 1920×1080 y DPR 2 mantuvo aproximadamente 106–125 FPS durante más de 150 s. En el caso extremo de 2560×1440 y DPR 2 todavía promedió 37 FPS: el filtro aplicado a imágenes en un Canvas grande seguía costando.

La siguiente revisión prerenderizó también las sombras. El Canvas grande ya no aplica desenfoque a esos sprites, y únicamente el punto/glint conservan primitivas nativas pequeñas. Es la misma estrategia de prerenderizar dibujo repetido y limitar trabajo con sombras descrita en la [documentación de optimización de Canvas de MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).

Una medición provisional de esta revisión alcanzó 128 FPS durante unos 114 s a 1920×1080, pero después se detectó un `InvalidStateError` por una superficie de tamaño cero. Esa medición NO valida estabilidad sostenida de esa versión.

La reproducción instrumentada capturó asignaciones `width/height = NaN` desde `arc-cache.paint`, seguidas del error de `drawImage`. La causa estaba en el easing: aunque la entrada de `smootherstep` estuviera acotada, su polinomio podía devolver `1.0000000000000009` por redondeo cerca de 1. El decay restaba ese valor a 1 y elevaba el resultado negativo a una potencia fraccionaria, obteniendo `NaN` para intensidad y dimensiones. Se acota también la salida del easing a [0, 1]; no se oculta la excepción ni se elimina un impacto. La comprobación numérica con las funciones compiladas actuales devuelve valores finitos en flash, settle, hold y cerca de los finales de glint, punto, limbo y corona. El tiempo y las curvas perceptibles no cambian.

### Confirmación tras corregir el easing

A 1920×1080, DPR 2, el fondo permaneció activo más de 237 s: aproximadamente 138 FPS en la muestra retenida y 131 FPS en los últimos 15 s. El p95 de intervalo de frame de la muestra fue 7.1 ms y el de ejecución JavaScript 1.8 ms. No se registraron errores ni dimensiones inválidas; siguió produciendo frames después del punto de fallo de las reproducciones anteriores. El DOM permaneció en 160 elementos y no hubo overflow horizontal. La instrumentación retiene como máximo 30.000 muestras, por lo que no se afirma que conserve todos los frames del intervalo completo.

En móvil emulado, 390×844/DPR 2 y CPU ralentizada 4×, continuó activo durante más de 444 s. La muestra retenida promedió 143 FPS, con p95 de intervalo de 7 ms y de ejecución JavaScript de 5.7 ms; los últimos 15 s promediaron 141 FPS. No hubo errores de consola, dimensiones inválidas ni overflow horizontal; el DOM permaneció en 171 elementos. La captura revisada conserva la jerarquía de controles y el texto central legible. Esta emulación no mide el rendimiento de una GPU móvil real.

El caso extremo anterior a la corrección numérica, 2560×1440/DPR 2, promedió 59 FPS durante 147 s; no se presenta como una garantía final de estabilidad ni como resultado de móvil. Tampoco se han medido todos los modelos de GPU.

La revisión de teclado confirmó foco visible, cambio del item anunciado mediante flecha, suspensión del RAF durante el foco y selección con Enter (Chitin Composite). El fondo se desmontó sin errores, y al limpiar la selección en móvil reapareció. Esto comprueba el flujo básico, no todos los casos de accesibilidad o navegación por rutas.

### Estela solicitada

Impeccable orientó el detalle como continuidad de la esfera, no como un nuevo foco visual: cola ámbar afinada, de hasta 26 px CSS, con transparencia creciente hacia atrás. Comparte progreso y extremos con el viaje; se limita al recorrido disponible y no atraviesa el emisor. No añade partículas, buffers de historial, nuevos timers ni `shadowBlur`. En movimiento reducido no hay viajes ni estelas.

## Decisión sobre librerías

Se inspeccionaron las dependencias directas y el lockfile. HeroUI, Framer Motion y Lucide ya proporcionan controles, preferencia de movimiento e iconos. React Flow y Dagre pertenecen al grafo de producción; no se reutilizan como física de este fondo ambiental. Las dependencias D3 transitivas no se convierten en una API pública del componente.

Opciones evaluadas:

| Opción                  | Código que podría sustituir                    | Coste o límite                                                                                       | Decisión                                                                 |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Canvas 2D propio        | Mantiene el dibujo y control exacto existentes | Requiere gestionar recursos y timelines                                                              | Mantener, con responsabilidades separadas                                |
| Framer Motion existente | Preferencia de movimiento; helpers de easing   | No sustituye física, topología ni dibujo                                                             | Reutilizar `useReducedMotion`; mantener los pequeños helpers polinómicos |
| PixiJS                  | Primitivas de dibujo y render loop             | Exige migrar objetos, assets y efectos; no resuelve el lifecycle de impactos                         | No añadir sin evidencia que justifique la migración                      |
| D3 quadtree             | Búsqueda espacial de vecinos                   | Requiere mantener el índice al moverse los nodos; no sustituye el renderer                           | Reservar para un cuello de botella medido                                |
| D3 force / force graph  | Integración de fuerzas                         | No elimina la distribución ambiental ni los efectos; la física de enlaces no corresponde al contrato | No reintroducir                                                          |
| tsParticles             | Emisores y bucle genérico de partículas        | La regresión visual está documentada por el usuario; no hay implementación histórica recuperable     | No reintroducir                                                          |

Fuentes primarias: [Motion: easing](https://motion.dev/docs/easing-functions), [PixiJS: Ticker](https://pixijs.com/8.x/guides/components/ticker), [D3: quadtree](https://d3js.org/d3-quadtree). La elección es una evaluación de encaje con este código, no una comparación medida de rendimiento o tamaños de bundle entre librerías.

No se añade ni elimina ninguna dependencia. `package.json` y `pnpm-lock.yaml` no cambian.

## Aspecto preservado

Se conservan iconos reales, superficies graphite, ámbar del theme, colores de categoría, densidad, overscan, copy central, movimiento lento compartido/individual, roaming, límites blandos, repulsión local y conexiones ambientales cambiantes. El ratón sólo modifica la respuesta visual, nunca la física. Las conexiones no representan recetas.

Impeccable se utilizó para preservar esta composición y reforzar control de movimiento, foco y estados estáticos, y después para integrar la estela discreta solicitada. No se sustituyó la estética de eclipse por otros efectos ni se rediseñó el Planner. Las capturas de navegador sirven de revisión acotada; los casos adicionales pendientes están indicados a continuación.

## Verificación técnica

Herramientas disponibles: Node.js 24.20.0 y pnpm 11.19.0. Los comandos utilizaron el directorio local de binarios en PATH porque el lanzador de pnpm de este entorno no lo resolvía inicialmente.

- Prettier `--write` sobre los archivos modificados: ejecutado. No se ejecuta `pnpm format` global para evitar reescribir Bases, que está pausado.
- Prettier `--check` sobre los 24 módulos del componente y sus dos documentos mantenidos: pasa. El documento original de auditoría se excluye para no reescribirlo.
- `pnpm format:check`: falla por tres archivos preexistentes sin formato: `src/features/base-designer/model/catalog.ts`, `src/features/base-designer/ui/build-palette-modal.tsx` y el documento original `codex-item-network-background-audit.md`. La petición original de auditoría se conserva sin cambios.
- `pnpm lint`: pasa, sin avisos.
- `pnpm build`: pasa; incluye `tsc -b` y Vite. Vite avisa de un chunk de aplicación superior a 500 kB (725.46 kB minificado); no es un error de compilación.
- Detector estático de Impeccable sobre el componente y su integración: sin incidencias. No demuestra contraste o paridad visual en ejecución.

La primera auditoría no ejecutó tests ni abrió el navegador, siguiendo entonces la preferencia del usuario. Posteriormente el usuario autorizó medir y mejorar rendimiento en navegador: se empleó Chrome DevTools con instrumentación temporal sólo en la página, nunca en el código de producción. No se ejecuta una suite de tests ni se afirma cobertura E2E. Las cifras son del entorno local (pantalla cercana a 144 Hz), no una garantía en dispositivos reales ni una auditoría de fugas de memoria. CPU throttling tampoco reproduce la GPU de un teléfono.

## Comprobación manual pendiente

1. Ampliar las capturas revisadas de escritorio/móvil con dispositivos reales y diferentes DPR. No se afirma paridad visual píxel a píxel con las versiones históricas.
2. Comprobar distribución y densidad en ultrawide de dispositivo real y su estabilidad prolongada, además de los tamaños emulados medidos. Observar nuevos vecinos sin deriva global ni amontonamiento.
3. Hacer resize grande y lento, incluso en pasos pequeños; reducir/ocultar el contenedor y recuperarlo. Confirmar continuidad, iconos conservados y ausencia de flashes.
4. Observar varias llegadas a un mismo nodo: cada impacto debe terminar su cola, conservar su ángulo y sobrevivir al enlace. El contacto debe coincidir con el borde, también al resaltar el nodo.
5. Comparar las capas: glint primero, punto después, limbo y corona al final; sin aro uniforme ni sobreexposición excesiva por superposición.
6. Salir del viewport, ocultar la pestaña y volver: sin salto temporal ni actividad ambiental mientras está suspendido.
7. Activar movimiento reducido antes de entrar y durante la sesión: red estática, iconos completos y selección funcional. Desactivarlo sin reconstrucción brusca.
8. Seleccionar por mouse y toque corto; deslizar en móvil sin activar un item por accidente. Ampliar la comprobación básica de teclado con Home/End, lector de pantalla y modalidades mixtas.
9. Cambiar de ruta rápidamente y volver varias veces, incluido Strict Mode: sin callbacks tardíos, bucles duplicados ni canvas vacío. Comprobar también los estados de carga y entrada del grafo de producción.

Si aparecen costes elevados en dispositivos reales, la siguiente medida es registrar un perfil con el escenario concreto antes de cambiar la arquitectura.
