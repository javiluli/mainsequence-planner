# Auditoría, recuperación y refactorización profesional de `ItemNetworkBackground`

Quiero que revises de forma completa el componente visual `ItemNetworkBackground` y toda su arquitectura relacionada.

Este componente ha pasado por varias iteraciones:

1. Existía una versión Canvas 2D propia que funcionaba visualmente bastante bien.
2. Se intentó dividir el código en archivos más pequeños.
3. Se probó una migración a `tsParticles`.
4. `tsParticles` empeoró el rendimiento, la densidad/composición y redujo demasiado algunas conexiones, por lo que se descartó.
5. Se volvió a Canvas 2D.
6. Durante el último refactor se han introducido inconsistencias entre archivos, imports, exports, helpers y responsabilidades.

Por tanto, NO quiero que continúes ciegamente desde el estado actual.

Quiero que primero entiendas el componente completo, recuperes su intención original y después construyas una versión limpia, coherente, optimizada y mantenible.

---

# 1. Objetivo principal

El objetivo es conservar o mejorar el resultado visual y funcional del componente, mientras:

- reduces complejidad;
- reduces código innecesario;
- eliminas duplicaciones;
- eliminas responsabilidades mezcladas;
- eliminas abstracciones que no aporten valor;
- mejoras rendimiento;
- mejoras mantenibilidad;
- mejoras la organización;
- corriges errores introducidos durante los últimos refactors;
- aprovechas correctamente las dependencias que ya existen;
- evalúas librerías nuevas solamente si realmente reducen complejidad.

La prioridad es:

> simplicidad + rendimiento + calidad visual + mantenibilidad.

NO quiero reducir código a costa de perder comportamiento.

---

# 2. Antes de modificar nada: reconstruye el contexto

Primero inspecciona completamente:

- el componente actual;
- todos sus subarchivos;
- sus imports y exports;
- `package.json`;
- dependencias y devDependencies;
- configuración TypeScript;
- configuración Vite;
- configuración ESLint;
- estilos relacionados;
- HeroUI/theme;
- utilidades ya existentes en el proyecto;
- tipos compartidos;
- sistema de iconos/assets;
- hooks del Planner;
- código que consume este componente.

Si existe documentación relacionada, especialmente algo similar a:

```text
/docs/item-network-background-context.md
```

léela primero.

También revisa:

```text
git status
git diff
git log
```

y el historial de Git del componente.

Quiero que localices la última versión anterior que funcionaba correctamente antes de:

- la migración a tsParticles;
- los últimos refactors fallidos.

Usa esa versión como referencia funcional y visual.

NO restaures archivos automáticamente sin comprender las diferencias.

Compara:

```text
versión estable anterior
vs
estado actual
```

para identificar exactamente qué comportamiento se perdió o rompió.

---

# 3. Comportamiento que debe conservarse

El componente representa una red ambiental decorativa/interactiva alrededor del empty state del Planner.

Debe conservar estas características.

## Nodos

Los nodos:

- representan items reales de Main Sequence;
- utilizan sus iconos reales;
- se distribuyen por toda la superficie;
- pueden aparecer parcialmente fuera de pantalla;
- deben evitar grandes zonas vacías;
- deben evitar excesiva concentración;
- tienen tamaños relativamente grandes;
- flotan lentamente;
- no deben tener una dirección global común;
- no deben parecer partículas viajando todas hacia el mismo lugar;
- deben cambiar lentamente de posición;
- deben poder cambiar sus vecinos a lo largo del tiempo;
- deben repelerse suavemente si están demasiado cerca;
- no deben amontonarse.

Debe mantenerse una zona central relativamente despejada para:

```text
Select an object to begin production
...
```

pero sin crear un agujero artificial enorme alrededor del texto.

---

# 4. Movimiento

La intención NO es crear una simulación física real.

Debe sentirse como:

```text
movimiento ambiental
+
roaming lento
+
micro movimiento individual
+
repulsión suave
```

Los nodos deben moverse lo suficiente para que, con el tiempo:

```text
unas conexiones desaparezcan
y
otras conexiones aparezcan
```

pero el movimiento debe seguir siendo lento y elegante.

Evita:

- jitter;
- rebotes agresivos;
- aceleraciones bruscas;
- comportamiento browniano;
- clusters;
- deriva global;
- movimientos sincronizados.

---

# 5. Conexiones

Las conexiones son decorativas.

NO representan relaciones reales de recetas.

Se basan principalmente en proximidad.

Deben:

- aparecer entre nodos suficientemente cercanos;
- desaparecer cuando se alejan;
- usar hysteresis para evitar flickering;
- hacer fade-in y fade-out;
- limitar conexiones por nodo;
- permitir ocasionalmente algún nodo ligeramente más conectado;
- mantenerse moderadas visualmente;
- no llenar toda la pantalla de líneas.

Los links NO deben controlar la física de los nodos.

Esto es importante.

La relación debe ser:

```text
movimiento de nodos
        ↓
distancia entre nodos
        ↓
creación/destrucción de links
```

y NO:

```text
links
 ↓
mueven nodos como resortes
```

---

# 6. Señales

Algunos links deben transportar una señal luminosa ámbar.

La señal:

```text
source
   │
   └──────────────●──────────────▶ target
```

debe:

- comenzar en el borde del nodo emisor;
- terminar exactamente en el borde del receptor;
- moverse suavemente;
- tener pequeña estela;
- utilizar easing sutil;
- no aparecer en todos los enlaces;
- no estar sincronizada con las demás.

Cuando alcanza el target debe producir un impacto.

---

# 7. Impactos

Este comportamiento es especialmente importante.

El impacto tiene estética de:

```text
eclipse
/
sun limb
/
space horizon
```

aproximadamente:

```text
       ✦
      ◖●
```

donde el cuerpo del nodo oculta parte de la iluminación.

Debe tener varias capas:

- corona trasera;
- limbo;
- punto brillante de contacto;
- pequeño glint;
- residuo luminoso.

La animación temporal debe sentirse cinematográfica:

```text
FLASH
  ↓
SETTLE
  ↓
HOLD
  ↓
DECAY LARGO
```

aproximadamente:

```text
~90 ms       aparición/flash
~270 ms      settle
~900 ms      hold
~2.3 s       decay
```

La duración exacta puede ajustarse si mejora visualmente.

El punto brillante debe desaparecer antes.

El glint debe desaparecer relativamente rápido.

El limbo debe mantenerse más tiempo.

La corona debe ser la última parte en desaparecer.

---

# 8. BUG crítico: impactos simultáneos

Existe una condición obligatoria:

## Los impactos deben ser independientes.

Si dos señales llegan al mismo nodo:

```text
impact A ─────▶ ◖ O ◗ ◀───── impact B
```

NO puede ocurrir que el segundo impacto sustituya, reinicie o apague al primero.

Cada impacto debe tener lifecycle propio:

```ts
{
  id,
  targetNodeId,
  angle,
  startedAt,
  duration,
  strength
}
```

o una estructura equivalente.

Un nodo puede tener:

```text
impact #1
impact #2
impact #3
```

simultáneamente.

Cada impacto debe completar:

```text
flash
settle
hold
decay
```

independientemente de los demás.

Además:

- el impacto debe sobrevivir aunque desaparezca el link que lo originó;
- el ángulo de impacto debe quedar congelado en el instante del contacto;
- el movimiento posterior del emisor NO debe rotar el impacto alrededor del target.

---

# 9. Interacción

El usuario puede hacer click sobre un nodo.

Debe continuar utilizando el comportamiento actual del Planner, por ejemplo mediante:

```ts
usePlannerTarget()
```

y:

```ts
selectTargetItem(...)
```

Comprueba la implementación real antes de asumir nombres o firmas.

El cursor:

- puede modificar sutilmente el render;
- puede resaltar nodo/link;
- NO debe cambiar la física de la red.

---

# 10. Resize

El resize debe ser suave.

Evita:

- reconstruir toda la red;
- flashes;
- canvas temporalmente vacío;
- nodos teletransportándose;
- recrear imágenes;
- saltos grandes.

Mantén la red existente y adapta posiciones razonablemente.

Revisa:

```text
ResizeObserver
devicePixelRatio
canvas backing store
CSS pixels
requestAnimationFrame
```

para evitar trabajo redundante.

---

# 11. Reduced Motion

Debe respetar:

```css
prefers-reduced-motion
```

Define claramente qué ocurre en este modo.

Por ejemplo:

- nodos estáticos o casi estáticos;
- sin señales animadas;
- sin impactos animados.

No mantengas loops o cálculos innecesarios si reduced motion está activo.

---

# 12. Rendimiento

Haz una revisión específica de rendimiento.

Busca:

- allocations dentro del animation frame;
- creación innecesaria de arrays;
- creación de Maps por frame;
- closures innecesarias;
- `Math.hypot` repetidos evitables;
- gradientes creados excesivamente;
- `save()/restore()` innecesarios;
- imágenes recreadas;
- consultas DOM dentro del loop;
- llamadas `getComputedStyle` dentro del loop;
- recalcular geometría que puede cachearse;
- recalcular topología cada frame;
- repulsión O(n²) innecesariamente costosa;
- culling;
- DPR excesivo;
- work ejecutado fuera del viewport;
- animation frame cuando la pestaña está oculta.

La cantidad normal de nodos es relativamente reducida, así que no optimices prematuramente sacrificando claridad.

Pero elimina trabajo claramente innecesario.

---

# 13. Arquitectura

La refactorización anterior intentó dividir demasiado algunos conceptos y terminó generando dependencias confusas.

NO quiero:

```text
20 archivos diminutos
para 20 funciones triviales
```

ni tampoco:

```text
network-renderer.ts de 900 líneas
```

Busca un equilibrio.

Una posible estructura sería:

```text
item-network-background/
├── index.ts
├── item-network-background.tsx
├── network.config.ts
├── network.types.ts
│
├── engine/
│   ├── network-engine.ts
│   ├── node-motion.ts
│   └── link-topology.ts
│
├── animation/
│   ├── signal-manager.ts
│   ├── impact-manager.ts
│   └── timelines.ts
│
├── render/
│   ├── network-renderer.ts
│   ├── render-nodes.ts
│   ├── render-links.ts
│   ├── render-effects.ts
│   └── render-primitives.ts
│
└── utils/
    └── network-math.ts
```

Pero NO adoptes esta estructura automáticamente.

Primero decide si cada archivo tiene una responsabilidad clara.

Prefiero aproximadamente:

```text
6-12 archivos claros
```

que 20 archivos excesivamente pequeños.

---

# 14. Imports y dependencias internas

Revisa TODOS los imports/exports.

No debe quedar ningún caso como:

```ts
import { rgba } from './render-links'
```

si realmente pertenece a:

```text
render-primitives
```

Evita dependencias circulares.

La dirección ideal es aproximadamente:

```text
config/types
   ↓
utils
   ↓
engine / animation
   ↓
render
   ↓
React component
```

El renderer nunca debe contener lógica física.

El engine nunca debe dibujar.

El animation manager nunca debe depender de React.

---

# 15. Revisión de librerías

Quiero que inspecciones primero TODAS las librerías que ya están instaladas.

Consulta:

```text
package.json
pnpm-lock.yaml
```

y busca si alguna ya instalada puede sustituir código propio de forma razonable.

Especialmente revisa librerías relacionadas con:

- animation;
- geometry;
- Canvas;
- rendering;
- easing;
- spatial indexing;
- graph/neighbour calculations;
- interpolation;
- vectors.

Después evalúa librerías externas actuales.

Puedes investigar opciones como:

```text
PixiJS
D3 / d3-force / d3-quadtree
Konva
GSAP
motion / framer-motion
Sigma
force-graph
tsParticles
RBush
Flatbush
gl-matrix
culori
```

pero NO asumas que debamos usar ninguna.

---

# 16. Criterio para introducir una librería

Una librería nueva sólo debe añadirse si cumple claramente varias de estas condiciones:

- elimina una cantidad significativa de código propio;
- mejora rendimiento;
- simplifica considerablemente la arquitectura;
- está activamente mantenida;
- tiene buena documentación;
- es compatible con React 19 y nuestro stack;
- no añade una cantidad excesiva de bundle;
- no introduce otro animation loop innecesario;
- no duplica nuestro Canvas;
- no fuerza un paradigma que contradiga el comportamiento visual buscado.

Por ejemplo:

Si una librería elimina:

```text
300 líneas
```

pero obliga a escribir:

```text
250 líneas de adapters
```

NO aporta valor.

Si una librería reduce:

```text
física + colisiones + neighbors + resize
```

a una integración limpia de 50 líneas sin cambiar comportamiento, puede merecer la pena.

Documenta la decisión.

---

# 17. Lección de tsParticles

Ya se probó `tsParticles`.

El resultado fue peor:

- peor rendimiento;
- menos nodos/conexiones visibles;
- peor composición;
- comportamiento diferente al original;
- duplicación de Canvas/render;
- seguíamos necesitando bastante código personalizado.

Por tanto:

NO vuelvas a introducir tsParticles salvo que descubras una razón técnica nueva y demostrable.

No uses una librería simplemente porque tenga menos líneas de configuración.

---

# 18. Posible uso de librerías pequeñas

Estoy especialmente abierto a librerías pequeñas y específicas.

Ejemplo:

En vez de sustituir TODO el motor:

```text
Canvas propio
↓
librería enorme
```

puede ser mejor:

```text
Canvas propio
+
pequeña utilidad para spatial lookup
```

o:

```text
Canvas propio
+
librería de easing
```

o:

```text
Canvas propio
+
quadtree
```

si realmente simplifica el código y mejora rendimiento.

Evalúa también este enfoque.

---

# 19. Dependencias obsoletas

Después de la auditoría:

- elimina imports muertos;
- elimina helpers muertos;
- elimina constants sin uso;
- elimina archivos muertos;
- elimina dependencias npm que ya no utilice el proyecto.

Pero antes de eliminar una dependencia:

```text
busca todos sus usos en el repositorio
```

No supongas que sólo la utilizaba este componente.

---

# 20. No sobreingeniería

Este componente es importante visualmente, pero sigue siendo un fondo decorativo.

No quiero convertirlo en:

```text
un framework de partículas
```

ni en:

```text
un motor gráfico genérico
```

Las abstracciones deben existir porque simplifican este componente concreto.

Evita:

- factories innecesarias;
- DI containers;
- exceso de clases;
- patrones empresariales;
- wrappers de una sola función;
- interfaces para implementaciones únicas;
- getters/setters innecesarios.

---

# 21. Código

El proyecto utiliza TypeScript estricto.

Respeta:

```text
strict
noUnusedLocals
noUnusedParameters
verbatimModuleSyntax
```

Utiliza:

```ts
import type
```

cuando corresponda.

No dejes:

- imports rotos;
- exports inexistentes;
- tipos `any`;
- casts innecesarios;
- métodos declarados pero no implementados;
- funciones duplicadas;
- helpers en archivos incorrectos.

---

# 22. Comentarios

El proyecto utiliza comentarios para explicar código no trivial.

Mantén comentarios donde expliquen:

- intención;
- decisiones;
- matemáticas;
- comportamiento visual;
- razones de rendimiento.

NO conviertas cada línea trivial en un comentario.

Prefiere:

```ts
/**
 * Evita que la topología cambie constantemente
 * cuando dos nodos oscilan alrededor del límite.
 */
```

a comentarios que sólo repitan el código.

---

# 23. Proceso que quiero que sigas

Trabaja en estas fases.

## Fase A — Diagnóstico

No modifiques todavía.

Analiza:

```text
componente actual
+
última versión funcional
+
historial
+
dependencies
```

y crea una lista breve con:

- problemas;
- regresiones;
- duplicaciones;
- responsabilidades mal ubicadas;
- problemas de rendimiento;
- oportunidades de simplificación;
- posibles librerías;
- partes que ya están bien.

---

## Fase B — Diseño

Define la arquitectura final.

Debe quedar claro quién controla:

```text
nodes
physics
links
signals
impacts
render
interaction
theme
resize
```

Explica qué archivos existirán y por qué.

---

## Fase C — Decisión sobre librerías

Compara al menos:

```text
mantener Canvas 2D propio
vs
usar librerías específicas
```

No quiero un ranking arbitrario.

Quiero argumentos concretos:

```text
qué código elimina
qué complejidad añade
bundle
performance
mantenimiento
integración
```

Después elige la solución técnica más simple que preserve el comportamiento.

---

## Fase D — Implementación

Una vez entendida la arquitectura:

- repara;
- refactoriza;
- optimiza;
- elimina residuos de intentos anteriores;
- conserva el aspecto visual.

NO hagas cambios visuales grandes deliberadamente durante la primera pasada.

Primero quiero recuperar:

```text
paridad funcional + visual
```

con la versión buena.

---

## Fase E — Validación técnica

Cuando termines ejecuta:

```bash
pnpm format
pnpm lint
pnpm build
```

Corrige TODOS los errores relacionados con tus cambios.

No dejes la feature en un estado de:

```text
"debería compilar"
```

Debe compilar realmente.

---

# 24. Tests

NO quiero que centres esta tarea en crear una suite grande de pruebas.

El componente es principalmente visual y yo mismo lo probaré manualmente.

Puedes:

- mantener tests existentes;
- corregirlos si tus cambios los rompen;
- añadir un test unitario pequeño si detectas lógica crítica que realmente lo merece.

Pero NO conviertas esta tarea en una campaña de testing.

La prioridad es:

```text
arquitectura
funcionalidad
rendimiento
visual
mantenibilidad
```

---

# 25. No cambies otras features sin necesidad

Limita el trabajo principalmente a:

```text
ItemNetworkBackground
```

y utilidades directamente relacionadas.

Si descubres que existe una utilidad compartida mejor en otra parte del proyecto, puedes reutilizarla.

Pero no aproveches esta tarea para refactorizar todo el Planner.

---

# 26. Comportamiento visual esperado

Después de terminar quiero volver a tener aproximadamente:

```text
     ○──────○
      \     │
       ●────○

   ○                ○
       \          /
        ○────────○

          TEXTO

     ○────○
          \
           ○──────○
```

con:

- buena distribución;
- pocos huecos grandes;
- conexiones visibles pero moderadas;
- movimiento lento;
- conexiones cambiantes;
- señales ocasionales;
- impactos cinematográficos;
- navegación por click;
- buen rendimiento.

NO quiero volver al resultado que produjo tsParticles, donde la red parecía:

- demasiado dispersa;
- con pocas conexiones;
- menos viva;
- y con peor rendimiento.

---

# 27. Pregunta antes si existe una decisión ambigua importante

Si descubres que para continuar correctamente necesitas decidir entre dos comportamientos que cambian significativamente:

- UX;
- estética;
- arquitectura;
- funcionalidad;

pregúntame antes.

Para decisiones técnicas internas pequeñas, toma tú la decisión más razonable y documenta brevemente por qué.

---

# 28. Resultado final

Cuando termines, dame un resumen breve con:

1. causa principal de los problemas actuales;
2. arquitectura final;
3. archivos creados/eliminados;
4. optimizaciones realizadas;
5. librerías evaluadas;
6. librerías añadidas/eliminadas;
7. comportamiento visual preservado;
8. cómo se resolvieron los impactos simultáneos;
9. resultado de:

```text
pnpm format
pnpm lint
pnpm build
```

10. cualquier punto visual que deba comprobar manualmente.

No quiero sólo una auditoría escrita.

Quiero que, después de entender el problema, implementes la solución completa y dejes `ItemNetworkBackground` en un estado sólido, limpio, compilable y mantenible.
