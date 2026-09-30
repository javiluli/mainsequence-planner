# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jugadores de Main Sequence que preparan cadenas de producción y organizan su base fuera del juego.

## Product Purpose

Consultar los datos extraídos del juego, calcular planes de producción, explorar investigación y diseñar disposiciones de estaciones antes de construirlas.

## Operating Context

El catálogo JSON generado desde FModel es la fuente de verdad de objetos, recetas e investigación. Las medidas de huellas del diseñador de bases pueden venir de observaciones directas del usuario cuando el export no las expone.

## Capabilities and Constraints

- El diseñador de bases inicial permite añadir estaciones, colocar máquinas repetidamente con una previsualización y trazar cintas ortogonales mediante anclas antes de confirmar la ruta completa.
- La huella de la estación 1×1 mide 14×14 celdas y la de la 2×2 mide 30×30. Todas las celdas de la huella son construibles, incluso las pegadas al límite; el marco decorativo sobresale ligeramente y las baldosas y los cuerpos de las máquinas tienen un pequeño margen óptico, sin alterar las huellas lógicas ni las conexiones. La 1×1 tiene una abertura de seis celdas por lado y la 2×2 tiene dos; al quedar las puertas alineadas con dos celdas vacías entre estaciones, se crea un pasillo construible de 2×6. No hay acoplamiento magnético: un hueco distinto o unas puertas desalineadas no conectan los módulos.
- Las aberturas I/O también son observaciones directas del usuario: reactor 2 por cara, refinería 1, ensamblador 2 con centro libre, contenedor 2, cámara de enriquecimiento 3 espaciadas y laboratorios de materiales/computación 1 en una sola cara. La dirección de la cinta determina si cada abertura conectada es entrada o salida.
- Las cintas paralelas contiguas no se unen por proximidad. Los extremos cabeza-cola pueden extender una ruta; terminar directamente contra el lateral de una cinta recta crea una entrada merge dirigida, nunca una salida ni un divisor implícito. Su movimiento visual se activa únicamente en caminos dirigidos completos desde una salida de máquina o dron asignado hasta una entrada de máquina; no implica una simulación de recursos o rendimiento.
- Un clic en el I/O de una máquina ancla la ruta de cinta en la celda libre exterior; un clic en el I/O de destino la termina y orienta el último tramo hacia la máquina.
- Cada ruta confirmada conserva una identidad única: seleccionar, desplazar o borrar un tramo actúa sobre la ruta completa y mantiene su forma.
- La paleta de bases se abre en un modal compacto por secciones; el clic central sobre una pieza recupera su herramienta. Los controles del lienzo incluyen selección, deshacer/rehacer, copiar/pegar, rotar y borrar. Una ruta de cinta puede ampliarse y atravesar estaciones alineadas sin perder su identidad. Las métricas de energía distinguen valores conocidos de datos todavía no extraídos del juego.
- Cada dron del módulo tiene un selector de ítems del catálogo en un modal y muestra el icono de su carga. Una máquina con receta puede marcar visualmente uno de los ítems de entrada de esa receta; cambiar la receta limpia una marca incompatible. Estos marcadores no simulan producción ni transportes.
- Las estaciones comparten suelo solo cuando coinciden las aberturas y el hueco de dos celdas; esto no las bloquea automáticamente para moverlas. Una pieza compartida o un candado explícito las hace trasladarse juntas. Las franjas de puerta admiten piezas y una máquina puede cruzar la junta como un único elemento. Un enlace ocupado o bloqueado entre dos estaciones impide borrar cualquiera de ellas; copiar un módulo aislado conserva rutas locales completas, omite la ruta entera si depende de otro módulo o pasillo, y omite las máquinas que cruzan su límite. El aviso de pegado cuenta rutas y piezas omitidas. Una ruta de cinta que cruza módulos conserva una única identidad para selección, movimiento y borrado.
- La tecla F desactiva solo la salida de un I/O de máquina: la entrada sigue disponible. Al rotar el edificio con R, la desactivación gira con ese puerto físico.
- El inspector de máquina incluye una sección desplegable «I/O ports» agrupada por cara y celda. Muestra entrada, salida, salida bloqueada, ausencia de cinta o de suelo accesible, con un botón de estado para cada salida. Este botón y F usan la misma acción; la conexión y el permiso de salida se derivan del plano, sin simular caudal. Su contenido se desplaza independientemente de los avisos, situados en una franja inferior fuera del plano.
- «Inventory» abre un panel plegable junto al lienzo (debajo en pantallas pequeñas). Agrupa cada ruta una sola vez, permite buscar por pieza, receta o estación y sincroniza la selección con el plano. Muestra estación propietaria o módulos de la ruta, orientación y receta cuando corresponde. Flechas/Home/End recorren la lista; Enter/Space selecciona, «Locate» encuadra explícitamente y «Settings» lleva al inspector. Copiar, rotar piezas y borrar usan las mismas acciones existentes; no se añaden focos por celda. Cerrar el panel devuelve el foco a su botón, y borrar o deshacer recupera un destino estable.
- La selección de máquinas, splitter y rutas usa ámbar, con borde interior en los cuerpos. El contenedor tiene placa neutra e icono de almacenamiento; conserva los dos I/O por cara. El splitter mantiene flechas de entrada teal y salida ámbar, realzadas al conectar, con caras enumeradas en el inventario. Los puertos sin cinta también muestran una salida desactivada; una entrada conectada conserva su flecha y añade una marca roja si su salida está desactivada. Productos arriba y marcador de entrada abajo usan tamaños ajustados a la máquina; los productos excedentes se resumen como «+N», sin ocultarlos en el inspector. Movimiento reducido detiene cintas y transiciones/animaciones de imágenes del plano e inspector.
- La cabecera de Bases es compacta; herramientas, métricas, edición y zoom tienen barras fuera del plano. Inspector e inventario comparten un único espacio lateral (inferior en pantallas pequeñas), nunca se superponen al suelo; «Inspector» permite cerrar/reabrir los ajustes de la máquina seleccionada y «Settings» pasa del inventario al inspector. La referencia de Planner es un popover explícito desde la barra, con scroll acotado. El encuadre automático ocurre solo al mostrar la primera estación de esta sesión del diseñador; añadir/borrar módulos, abrir paneles y redimensionar no ejecutan fit. «Fit layout» y «Locate» son las acciones explícitas de encuadre. Las notas nuevas se sitúan en el centro del lienzo disponible, no de la ventana completa.
- Una máquina con receta muestra sobre su placa el producto principal y los coproductos confirmados por el catálogo; la marca de entrada elegida por el usuario permanece debajo. El panel identifica cada producto sin inferir flujo de materiales por las cintas.
- La referencia de Planner en Bases cuenta inventario colocado en toda la base por tipo de máquina frente al número planificado, no cobertura de recetas o pasos concretos. Los edificios ausentes de la paleta se indican expresamente; las cifras Mk1/Mk2 son capacidades nominales por cinta y no caudal simulado. También explica los objetivos sin máquinas y los planes inválidos.
- Al dibujar una cinta, el preview y los avisos comparten el diagnóstico del trayecto: suelo o pasillo desconectado, pared, ocupación, dirección, tier incompatible y longitud/forma del túnel. Un rechazo conserva las anclas ya aceptadas para poder corregir solo el tramo.
- La selección de área incluye piezas y rutas completas, no estaciones ni notas. Pegar piezas activa un preview centrado bajo el puntero y ajustado a celdas; clic o Enter confirma una sola copia, flechas mueven el preview con teclado y Escape/clic derecho cancela. Preview y store usan la misma proyección y validación atómica: no se busca otra ubicación ni se coloca una copia parcialmente. Las estaciones y notas se siguen duplicando por separado con su comportamiento anterior.
- El prototipo conserva el diseño solo durante la sesión actual del navegador; no debe guardarlo de forma permanente todavía.
- Escape/clic derecho cancelan los previews y movimientos sin confirmar; perder el foco de la ventana también devuelve la herramienta a Select y restaura el movimiento en curso de estaciones/notas. Cambiar herramienta, copiar, rotar, borrar o usar undo/redo descarta capturas y previews anteriores. Un segundo puntero no toma el control de un arrastre de piezas. Un desplazamiento rechazado o un módulo/nota que termina en su posición inicial no añade otra entrada de historial. Las comprobaciones funcionales/visuales y la medición en bases grandes siguen siendo manuales pendientes, no garantías de rendimiento.
- No se deben inventar recetas, edificios de producción ni relaciones de investigación ausentes del catálogo.

## Evidence on Hand

- Catálogo generado: `src/shared/data/main-sequence/`.
- Iconos exportados: `public/assets/icons/`.
- Medidas iniciales y método de trazado de cintas: indicaciones directas del usuario en esta tarea.

## Product Principles

- Priorizar la fidelidad a los datos del juego y distinguirla de las medidas aún provisionales.
- Hacer rápidas las operaciones repetitivas de planificación y colocación.
- Mantener una arquitectura por features que permita ampliar el prototipo sin romper el planner existente.
