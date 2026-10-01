# Item Network Background — Contexto técnico y visual

## 1. Propósito del componente

`ItemNetworkBackground` es el fondo animado e interactivo del estado vacío del **Production Planner** de Main Sequence Planner.

Su objetivo no es representar una receta real ni simular el sistema de producción del juego. La red es **ambiental y decorativa**, pero utiliza items reales del proyecto para que el fondo siga perteneciendo visualmente al producto.

Debe transmitir la sensación de:

- una red neuronal / red de producción viva;
- actividad constante pero discreta;
- un sistema que continúa más allá de los bordes de la pantalla;
- conexiones que aparecen y desaparecen de forma orgánica;
- transferencia de energía/información entre nodos;
- una interfaz tecnológica pero minimalista;
- integración completa con el theme personalizado de HeroUI.

El componente vive en el estado inicial del Planner, antes de que el usuario seleccione un item.

---

## 2. Filosofía visual

La referencia conceptual no es un grafo de datos convencional.

No queremos:

- un force graph que colapse hacia el centro;
- partículas aleatorias sin relación visual;
- movimiento constante en una dirección;
- efectos de neón excesivos;
- una red saturada;
- animaciones agresivas;
- una visualización que compita con el mensaje central;
- una simulación físicamente realista innecesariamente compleja.

Sí queremos:

- movimiento lento y continuo;
- nodos que “revoloteen” suavemente;
- zonas de la red que se deformen juntas;
- pequeñas variaciones individuales;
- separación suficiente entre nodos;
- conexiones dinámicas por proximidad;
- algunos pequeños hubs;
- espacio negativo;
- sensación de profundidad e infinito;
- actividad visible sólo cuando se observa el fondo con atención.

La jerarquía visual buscada es:

1. navegación y toolbar;
2. copy central;
3. nodos;
4. conexiones;
5. señales / impactos.

---

## 3. Arquitectura actual

La API pública permanece en la raíz. La implementación está dividida por responsabilidad, sin módulos genéricos fuera de la feature:

```text
src/features/planner/ui/item-network-background/
├── index.ts
├── item-network-background.tsx
├── network.config.ts
├── network.types.ts
├── hooks/
│   ├── use-network-canvas.ts
│   └── use-network-interaction.ts
├── runtime/
│   ├── network-runtime.ts
│   ├── observe-surface.ts
│   └── item-image-cache.ts
├── simulation/
│   ├── network-engine.ts
│   ├── node-population.ts
│   ├── node-motion.ts
│   └── network-topology.ts
├── animation/
│   ├── network-animation.ts
│   └── impact-envelope.ts
├── rendering/
│   ├── network-renderer.ts
│   ├── render.types.ts
│   ├── links.ts
│   ├── nodes.ts
│   ├── signal.ts
│   ├── impacts.ts
│   └── arc-cache.ts
└── lib/
    ├── math.ts
    └── palette.ts
```

- `index.ts`: API pública. El Planner carga el componente de forma diferida, sólo para su estado vacío.
- `item-network-background.tsx`: composición del Canvas y sus instrucciones/estado accesibles; no contiene simulación ni observadores.
- `hooks/`: puente entre React y el runtime; selección por teclado/puntero sin actualizaciones React por frame.
- `runtime/`: reloj activo, RAF, medidas, suspensión automática, observadores y recursos de imagen. Cada montaje posee un único motor, animación y caché de efectos; el cleanup libera todos.
- `simulation/`: el motor coordina el orden de población, fuerzas ambientales e integración y actualización topológica. No conoce Canvas ni React. Los IDs y los parámetros aleatorios sobreviven al resize.
- `animation/`: viajes y eventos independientes de impacto, más sus envolventes temporales. El renderer no inicia ni finaliza sus ciclos.
- `rendering/`: capas separadas para enlaces/señales, corona trasera, cuerpos e impacto frontal. `arc-cache.ts` prerenderiza arcos y sombras en superficies pequeñas reutilizables.
- `lib/`: geometría y easing, radio visual compartido, lectura de tokens CSS y colores derivados. El theme se consulta fuera del frame.
- `network.config.ts`: parámetros visuales y de movimiento.
- `network.types.ts`: contratos compartidos.

Las dependencias avanzan desde tipos/configuración y helpers hacia motor/animación, dibujo y React. Las referencias de animación y dibujo al motor son de tipo. No hay una simulación de recetas dentro del fondo.

---

## 4. Items y contenido

Los nodos representan items reales del juego.

Las imágenes se obtienen mediante:

```ts
getIconSource('items', itemId)
```

Los items vienen de:

```ts
import { items } from '@/shared/data'
```

Importante:

**las conexiones NO representan recetas reales.**

Actualmente son conexiones ambientales calculadas por proximidad.

No se debe inferir producción, dependencias, ratios ni relaciones reales de recetas a partir de esta red.

Esto es intencionado.

---

## 5. Distribución de nodos

Una versión anterior utilizaba posiciones aleatorias y podía generar grandes zonas vacías.

La intención actual es distribuir mejor los nodos sin aumentar artificialmente la densidad.

La estrategia utiliza múltiples posiciones candidatas y elige una posición que tenga buen espacio respecto al resto.

Objetivo:

- evitar huecos enormes;
- evitar clusters excesivamente densos;
- conservar irregularidad;
- mantener nodos parcialmente fuera del viewport;
- evitar una cuadrícula evidente.

La distribución nunca debe parecer perfectamente uniforme.

Una irregularidad moderada es deseable.

---

## 6. Sensación de red infinita

Parte de los nodos pueden encontrarse parcialmente fuera de pantalla.

Esto es deliberado.

La red no debe parecer contenida dentro de un rectángulo.

Los márgenes de overscan permiten que:

- algunos nodos entren y salgan parcialmente;
- conexiones continúen fuera del viewport;
- el usuario perciba una estructura mayor que la pantalla.

Evitar soluciones que hagan rebotar visiblemente los nodos en los límites del Canvas.

Los límites deben sentirse blandos.

---

## 7. Movimiento de los nodos

El movimiento tiene varias capas.

### 7.1 Campo compartido

Los nodos próximos reciben parte del mismo desplazamiento.

Esto hace que una zona completa de la red se deforme de manera parecida a una membrana suspendida.

Es importante porque evita que cada nodo parezca una partícula independiente.

### 7.2 Roaming de largo alcance

Los nodos exploran lentamente una zona mayor alrededor de su región base.

Este movimiento existe principalmente para permitir que la topología cambie.

Sin roaming suficiente:

- los mismos nodos permanecen siempre vecinos;
- las conexiones casi nunca cambian;
- la red parece animada pero estructuralmente estática.

El roaming debe ser lento.

No debe parecer que los nodos están viajando por la pantalla.

### 7.3 Micro movimiento individual

Hay una pequeña variación adicional por nodo.

Su finalidad es romper trayectorias demasiado matemáticas.

No debe dominar el movimiento.

### 7.4 Repulsión

Los nodos se repelen suavemente cuando están demasiado cerca.

Su objetivo es mantener legibilidad y evitar solapamientos.

No buscamos una simulación de fuerzas compleja.

---

## 8. Lo que NO debe ocurrir con el movimiento

No queremos:

- desplazamiento global hacia derecha, izquierda, arriba o abajo;
- deriva continua;
- órbitas perfectamente circulares;
- movimiento rápido;
- rebotes duros;
- jitter;
- repulsión provocada por el cursor;
- nodos persiguiendo el ratón;
- reinicio de la simulación durante resize.

El cursor es únicamente una interacción visual.

---

## 9. Conexiones dinámicas

Las conexiones aparecen y desaparecen según la distancia entre nodos.

Existe una histeresis:

- una distancia para crear una conexión;
- una distancia ligeramente mayor para eliminar una conexión existente.

Esto evita flickering cuando dos nodos se encuentran cerca del límite.

Los nodos tienen distintos límites de conexiones.

La mayoría utiliza pocas conexiones y algunos actúan como pequeños hubs.

Objetivo visual:

```text
       ○
       │
○──────○──────○
       ╲
        ○
```

y no:

```text
○────○────○────○────○
```

ni una telaraña donde todo conecta con todo.

---

## 10. Las conexiones son efímeras

El roaming debe provocar que:

1. dos nodos se aproximen;
2. aparezca una conexión;
3. permanezcan conectados durante cierto tiempo;
4. se alejen;
5. la conexión haga fade-out;
6. ambos puedan formar nuevas conexiones.

La red debe cambiar lentamente cuando el usuario permanece en la pantalla.

No es necesario que la topología cambie cada pocos segundos.

El cambio debe percibirse como orgánico y ocasional.

---

## 11. Zona central

El estado vacío muestra un copy central:

> Select an object to begin production

junto con su descripción.

Los nodos evitan suavemente esta región para preservar legibilidad.

Sin embargo, no queremos que parezca un “círculo prohibido” evidente.

Por eso:

- la zona protegida debe ser relativamente pequeña;
- los nodos pueden acercarse al copy;
- algunas conexiones pueden atravesar la región;
- las conexiones se atenúan al pasar detrás del texto.

Esto mantiene continuidad visual sin comprometer lectura.

---

## 12. Interacción con el cursor

El cursor no modifica la física.

No existe:

- atracción;
- repulsión;
- desplazamiento;
- deformación física de nodos.

La respuesta al cursor es visual y sutil:

- ligero aumento de presencia;
- borde algo más visible;
- conexión ligeramente reforzada;
- cursor `pointer` cuando el nodo es clicable.

La intención original de repeler nodos con el cursor fue descartada porque resultaba demasiado artificial.

---

## 13. Selección e interacción accesible

Un click o toque corto sobre un nodo llama a `selectTargetItem(node.itemId)` mediante el hook real `usePlannerTarget`. Un arrastre o gesto de scroll no debe convertirse en selección.

El Canvas es una única parada de teclado:

- flechas, Home y End recorren los nodos visibles;
- Enter o Espacio seleccionan el item activo;
- el nombre se anuncia mediante un estado accesible;
- mientras se navega por teclado, el movimiento queda detenido para conservar un objetivo estable.

No hay un modo de pausa manual. La suspensión automática por movimiento reducido, foco de teclado o falta de visibilidad conserva la accesibilidad y evita trabajo innecesario.

---

## 14. Señal de transferencia

Algunas conexiones muestran una señal ámbar que viaja de un nodo a otro.

El objetivo es sugerir:

- información;
- energía;
- actividad;
- comunicación entre nodos.

No representa flujo real de producción.

### Recorrido

La señal debe viajar:

**desde el borde del nodo emisor hasta el borde del receptor**.

No debe viajar de centro a centro.

Esto es importante porque si la partícula continúa visualmente hacia el centro, el impacto parece producirse tarde.

### Movimiento

El recorrido mezcla movimiento lineal con easing suave.

Buscamos:

- movimiento continuo;
- sin aceleraciones bruscas;
- sin sensación robótica;
- llegada exacta al receptor.

### Estela de cometa

La esfera lleva una cola ámbar corta, afinada y transparente en el extremo posterior. Se calcula a partir del mismo progreso de viaje, con un máximo de 26 píxeles CSS; nunca rebasa el emisor ni crea partículas independientes. El cuerpo de la esfera y el contacto con el receptor conservan su geometría y timing. La cola no mantiene buffers de posiciones ni añade desenfoque. Sólo se dibuja durante el viaje, no durante la espera o con movimiento reducido.

---

## 15. Timeline de señal e impacto

`NetworkAnimation` controla un único reloj que sólo avanza durante frames activos. Cada enlace con señal alterna entre espera y viaje:

```text
WAIT → TRAVEL → CONTACT → WAIT
                     ↘ impacto independiente
```

La llegada crea un evento con identidad, receptor, ángulo congelado, instante de inicio, duración e intensidad propios. El impacto completa su timeline aunque desaparezca el enlace o se mueva el emisor. Varias llegadas al mismo receptor no se sustituyen ni reinician entre sí.

El renderer utiliza el mismo radio visual del nodo para terminar la señal y dibujar el punto de contacto. No deduce llegadas mediante un módulo temporal, ni selecciona sólo el impacto más fuerte de cada nodo.

Foco de teclado, pestaña oculta y salida del viewport congelan el tiempo sin provocar un salto al volver. Movimiento reducido elimina señales e impactos y conserva una superficie estática.

---

## 16. Impacto / absorción

Cuando una señal llega al receptor se produce un impacto breve.

La referencia visual es:

- eclipse;
- ocultación;
- sol quedando detrás de un planeta;
- brillo de horizonte;
- pequeño diamond-ring effect.

No buscamos una explosión.

No buscamos una onda de choque.

No buscamos un aro completo.

### Secuencia buscada

1. la señal toca el borde;
2. aparece muy rápidamente un punto brillante;
3. el borde receptor se ilumina localmente;
4. aparece una corona tenue detrás;
5. la luz pierde intensidad lentamente;
6. desaparece.

---

## 17. Forma temporal del impacto

La referencia vigente es la auditoría `codex-item-network-background-audit.md`, no la duración antigua de 1–1.5 segundos.

La duración total es de **3.6 segundos**, con fases compartidas:

```text
FLASH (90 ms) → SETTLE (270 ms) → HOLD (900 ms) → DECAY (2.34 s)
```

El ataque es rápido y la cola larga; no es una animación simétrica. Las capas tienen finales diferentes, medidos desde el contacto:

- glint: aproximadamente 2.09 s;
- punto brillante: aproximadamente 2.59 s;
- limbo: aproximadamente 3.38 s;
- corona: 3.6 s.

Cada capa pierde intensidad suavemente antes de su final. Estos valores están centralizados en configuración; afinarlos requiere comparar el resultado visual, no cambiar simultáneamente física y dibujo.

---

## 18. Impacto tipo eclipse

El impacto está compuesto por varias capas.

### 18.1 Corona trasera

Se dibuja **antes del nodo**.

Después el cuerpo oscuro del nodo tapa parte de esa luz.

Esto crea una sensación de ocultación:

```text
       corona
       ╭───
        ●
```

en lugar de:

```text
      ( ○ )
```

### 18.2 Limbo / horizonte

Se dibuja delante del nodo.

La intensidad máxima está en el punto donde llega la señal.

Debe disminuir progresivamente hacia ambos lados.

Forma aproximada:

```text
·░▒▓███▓▒░·
      ↑
    impacto
```

Nunca debe parecer un arco uniforme:

```text
██████████
```

### 18.3 Punto de contacto

Es un pequeño punto blanco/ámbar muy localizado.

Debe ser pequeño y brillante, con halo suave.

No debe parecer otra partícula estacionaria.

### 18.4 Glint tangencial

Se añade una línea muy corta tangencial al borde.

Su función es reforzar el efecto de luz asomando por detrás de un cuerpo oscuro.

Debe ser extremadamente discreta.

---

## 19. HeroUI y colores

El componente debe integrarse con el theme existente.

No utilizar colores arbitrarios que rompan la UI salvo pequeños ajustes derivados del color `primary`.

La paleta Canvas se obtiene del theme mediante variables CSS.

La intención actual es:

- conexiones: azul/gris oscuro;
- nodos: colores del sistema de items;
- señales: `primary` ámbar;
- impactos: versiones cálidas y ligeramente más luminosas del `primary`;
- fondo: perteneciente a la superficie existente.

No queremos estética cyberpunk/neón.

---

## 20. Resize

El resize conserva nodos, identidades, seeds y caché de imágenes. Cada cambio real de medida adapta proporcionalmente las posiciones existentes, incluidos cambios sucesivos de uno o dos píxeles.

La población usa histéresis para no añadir y quitar nodos continuamente. Las conexiones se recalculan con sus reglas de proximidad; no se reconstruye la red completa.

Canvas usa píxeles CSS para geometría y un backing store con DPR limitado a 2. Su tamaño físico cambia inmediatamente antes de dibujar, para no dejar un Canvas borrado esperando otro frame. Cambios de DPR invalidan el dibujo sin recrear el motor.

En modo estático, la población y conexiones se resuelven una sola vez tras un resize, sin un bucle permanente de asentamiento.

---

## 21. Primer render y cleanup

La medida inicial ocurre en `useLayoutEffect`. Si el contenedor todavía mide cero, se permiten hasta tres intentos; `ResizeObserver` atiende cualquier medida posterior. No se mantiene un RAF de polling indefinido.

La carga de un icono invalida el dibujo, también en modo estático. Un error de imagen conserva el cuerpo del nodo sin intentar recargar el mismo recurso en cada frame.

Cada montaje posee sus recursos y su cleanup: RAF de dibujo/medida, observadores, listeners, callbacks de imágenes y controller de interacción. Strict Mode y cambios rápidos de ruta utilizan la misma ruta de liberación.

---

## 22. `prefers-reduced-motion`

El sistema se observa mediante `useReducedMotion` de la dependencia existente `framer-motion`.

En este modo:

- nodos y conexiones siguen visibles y seleccionables;
- no avanzan la física ni las timelines;
- señales e impactos se eliminan;
- no existe un RAF permanente;
- medidas, carga de iconos, theme e interacción pueden solicitar un único dibujo.

Un cambio de preferencia se aplica sin desmontar el fondo. Al reactivar el movimiento, las señales comienzan de nuevo sin reproducir tiempo pasado.

---

## 23. Rendimiento

La animación activa usa Canvas y un único RAF; React sólo actualiza controles e información accesible al interactuar.

Se conserva una población acotada de 26–94 nodos y la topología se revisa cada 0.13 s, no cada frame. Las pruebas de distancia descartan pares mediante distancia al cuadrado antes de calcular raíces o candidatos.

Las imágenes se cachean por ID y los colores derivados se reutilizan. Los arcos afinados y sus sombras se prerenderizan en una caché LRU de hasta 64 superficies pequeñas, con una máscara de trabajo compartida. El Canvas principal compone esas imágenes sin volver a aplicarles `shadowBlur`. Radio, grosor, opacidad y blur se discretizan; posición, rotación y opacidad final se compensan al componer para mantener continuidad. La caché distingue colores y DPR y se libera al desmontar. El punto de contacto y el glint conservan sus sombras nativas pequeñas.

No se crea un Map de impactos por frame ni se consultan estilos del DOM dentro del dibujo. Nodos, enlaces e impactos fuera de la superficie se omiten.

El RAF se suspende con foco de teclado, movimiento reducido, pestaña oculta, contenedor de tamaño cero y salida del viewport.

La ralentización sostenida se reprodujo en producción: el coste principal era rasterizar miles de segmentos con sombra por frame, no el tiempo de física JavaScript. El informe `item-network-background-implementation.md` distingue las mediciones anteriores y finales, con tamaños, DPR y limitaciones. No se certifica rendimiento en cualquier dispositivo ni ausencia de fugas de memoria. La repulsión sigue siendo O(n²) y las estelas utilizan un gradiente de geometría dinámica; no se añade un índice espacial o WebGL sin evidencia de otro cuello de botella.

El easing compartido acota tanto la entrada como el resultado del polinomio. Un pequeño overshoot por redondeo cerca de 1 no puede generar energía restante negativa: las potencias fraccionarias del decay deben permanecer finitas hasta desaparecer. Esta invariancia evita que un final de impacto genere dimensiones `NaN` en la caché y detenga el RAF.

---

## 24. Razón por la que ya no se usa `react-force-graph-2d`

Se probó inicialmente.

El problema principal fue que el force graph tendía naturalmente a:

- agrupar los nodos;
- colapsarlos hacia el centro;
- depender de su propia cámara;
- complicar el control exacto del viewport;
- dificultar la composición alrededor del copy.

El objetivo real es un fondo ambiental controlado, no un grafo navegable.

Por eso se migró a un Canvas propio con posiciones en píxeles CSS.

No volver a introducir una librería de force graph salvo que exista una razón técnica clara y demostrable.

---

## 25. Cosas que Codex debe revisar

La auditoría del componente debería centrarse especialmente en:

- posibles errores matemáticos;
- inconsistencias entre engine y renderer;
- valores no utilizados;
- imports muertos;
- constantes redundantes;
- duplicación;
- allocations innecesarias por frame;
- posibles problemas de rendimiento en ultrawide / HiDPI;
- comportamiento con muchas resoluciones;
- resize continuo;
- primer montaje;
- cleanup de observers / RAF;
- carga de imágenes;
- memoria;
- `prefers-reduced-motion`;
- interacción mouse / touch;
- accesibilidad;
- tipos TypeScript;
- posibles race conditions;
- cambios de theme;
- comportamiento al entrar/salir rápidamente de la página;
- estabilidad de conexiones;
- aparición de huecos grandes;
- clusters excesivos;
- movimiento demasiado evidente;
- ausencia de cambios topológicos;
- sincronización señal → impacto;
- suavidad del impacto;
- posibilidad de simplificar código manteniendo exactamente el resultado visual.

También debe detectar símbolos obsoletos o sin uso. Por ejemplo, si una constante de configuración como `SPAWN_DISTANCE_FACTOR` ya no participa en ningún cálculo, debe eliminarse junto con su import en lugar de conservarla por compatibilidad accidental.

---

## 26. Prioridades al refactorizar

Orden de prioridad:

1. **corrección**;
2. **estabilidad**;
3. **fluidez visual**;
4. **rendimiento**;
5. **simplicidad**;
6. **mantenibilidad**;
7. micro-optimizaciones.

No sacrificar el comportamiento visual para conseguir una reducción marginal de líneas.

Tampoco conservar complejidad accidental simplemente porque la versión actual funciona.

Si dos sistemas pueden convertirse en uno manteniendo la misma intención visual, simplificarlos.

---

## 27. Restricciones importantes

Al revisar/refactorizar:

- no convertirlo en una simulación de recetas;
- no cambiar los JSON fuente de datos;
- no eliminar el click de selección;
- no introducir desplazamiento direccional global;
- no añadir repulsión del cursor;
- no aumentar mucho la densidad;
- no convertir los efectos en neón;
- no saturar el centro;
- no reconstruir la red durante resize;
- no utilizar React state para animación por frame;
- no romper el theme HeroUI;
- no introducir una nueva dependencia grande sin una razón fuerte.

---

## 28. Resultado visual esperado

En reposo:

```text
       ○──────○
      ╱        ╲
     ○          ○

           COPY

              ○────○
             ╱
        ○───○
```

Después de un tiempo:

```text
       ○       ○
        ╲     ╱
         ○───○

           COPY

       ○────○
            ╲
             ○────○
```

Transferencia:

```text
○────────●────────○
```

Llegada:

```text
○────────────────◖✦○
```

Decay:

```text
○────────────────◖░○
```

Final:

```text
○──────────────────○
```

---

## 29. Qué significa “profesional” en este componente

No significa añadir más efectos.

Significa que:

- cada movimiento tiene una razón;
- ninguna animación llama demasiado la atención;
- todo responde correctamente al viewport;
- los nodos nunca parecen rotos o congelados;
- las conexiones evolucionan;
- las señales llegan exactamente a su destino;
- los impactos tienen continuidad;
- el theme se respeta;
- el componente se puede mantener sin miedo;
- las constantes tienen significado claro;
- las responsabilidades están correctamente separadas.

La meta final es que el usuario perciba la red como un sistema vivo de fondo, sin preguntarse conscientemente cómo está animada.

---

## 30. Instrucción para Codex

Antes de modificar código:

1. leer todos los archivos del componente;
2. leer dónde se usa `ItemNetworkBackground`;
3. revisar las utilidades de theme, items e iconos relacionadas;
4. entender esta documentación;
5. identificar problemas reales y complejidad accidental;
6. explicar brevemente cualquier cambio arquitectónico importante antes de implementarlo.

Durante el refactor:

- conservar la intención visual descrita aquí;
- preferir simplificaciones que reduzcan estados y cálculos duplicados;
- eliminar constantes/imports/ramas que hayan quedado obsoletos;
- mantener TypeScript estricto;
- mantener comentarios sólo donde expliquen decisiones no obvias;
- evitar comentarios que simplemente repitan lo que hace el código.

Después:

- revisar que no queden símbolos sin usar;
- revisar que ninguna constante configurable haya perdido efecto;
- revisar que resize, primer render y cleanup sigan siendo robustos;
- revisar que la señal e impacto compartan una timeline coherente;
- confirmar que el roaming realmente puede provocar nuevas conexiones sin convertir la red en movimiento caótico.

Si alguna recomendación entra en conflicto con la intención documentada, detenerse y plantear la duda antes de cambiar el comportamiento.
