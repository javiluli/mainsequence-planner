# Ideas para aplicar al "base building"

Este documento registra todas las nuevas interacciones que se deben agregar al base building.
Para dejar claro, esta herramienta no es un simulador, no contempla ratios de items, velocidades de cinta óptimos, producción eficiente, o similar, solo contempla que la colocación de elemento dentro de un espacio concreto es óptimo, para agilizar la construcción de bases complejas.

Las ideas a implementar será las siguientes:

- Mejora visual para los "splitter", y edificios como el "container", para mejor visualización de los I/O, ya que ahora mismo dificulta un poco.
- Poder asignar a los edificios los items del juego que produce en base a los que recibe, para poder construir con más orden las fábricas y no perder el seguimiento y función de cada edificio
- las cintas se deben juntar cuando estas se apunten directamente, explico, teniendo una cinta en una dirección recta, si dirijo una cinta de un punto X y la dirijo directamente a esta para "cruzarla" deberá actuar como un merge de cintas, esto no aplica al caso contrario para separar o dividir
- Agregar el edificio de los drones para tener un punto output siempre de items, actúa como un contenedor pero esto permite que actúe como parte de la base, como las estaciones, y además tiene dos outputs de items (asignable)
- En las conexiones de estaciones, aunque no haya conexión entre ellos, poder bloquear con un icono de candado o similar para que no se separen y evitar dificultades al construir
- Agregar de nuevo las cintas y splitters mk2
  Las cintas subterráneas tiene una función especial, estas tiene un input, luego se desplazan "por debajo del suelo", la mk1 tiene de máximo 6 bloques de longitud por debajo, más la entrada y la salida, y el mk2 tiene 8 bloques subterráneos, lo que permite construir encima (esto represéntalo también con cintas pero con algo de opacidad a no ser que haya una mejor forma) y al final tiene la salida para transportar los items, estas cintas no se conectan por debajo con otras cintas ni nada, son solo un túnel directo por debajo.
- Poder copiar un área (como en el starrupture-planner pulsando shift + click izq), para poder copiarlo todo, mover, borrar, agilizando la construcción y movilidad de las estructuras
- Poder crear notas/etiquetas que permita escribir anotaciones en lugares concretos, no está asociado a nada, es un elemento libre de mover
- mueve el reactor a otra categoría de "Power" porque no crea nada solo crea energía, y mueve container a otra categoría "Storage" porque solo almacena, y las estaciones, crea una representación de cada uno reducida para verla en el modal, puedes hacer que visualmente en el modal sean igual de grandes pero la representación de la cuadrícula naranja en unas haya más, o haz esto mismo pero el 2x2 hazlo un poco más grande.
- Revisar los medidores de energía producida VS energía consumida, esto es solo un marcador, no implica nada en el creador.
- Una mecánica importante dentro del juego, hay máquinas como el Assembler, que los i/o se puedes desactivar, y por lo tanto las cintas no se puedes conectar, esta función dentro del juego se aplica mirando al i/o de la máquina y pulsando F, aplícalo aquí también, si i/o actúa como input, esta función es transparente, los items entran igual en la máquina, pero si actúa como salida, entonces si se desactiva, no saldrán items y la cinta se "desconecta", si se vuelve a activar, la cinta conecta y los items salen.
- Un botón en la tabla de items, building para cada item, y en el planner, que abra /bases, y permita ver las máquinas necesarias y las cantidades, de esta forma se sabrá las máquinas que se necesitan, qué recurso crear, si se usa una cinta mk1 o mk2 para saber cuánto recurso llega a una máquina y cuánto falta, así será mucho más completo.

Con estos puntos, mejoras de rendimiento y una auditoría para un creado de bases óptimo, tendremos una herramienta bastante completa, no se contempla la falta de recursos para conectar cintas, máquinas, energía, pero permitirá crear un flujo completo de creación de un item. Se deberá crear una organización correcta, bien estructurada y simplificada, evitando 10 capas de carpetas o ficheros inmensos de 1000 líneas de código.

Para estas tareas, debes usar las skills instaladas, todas ellas, cada una para su tarea concreta, puedes, para optimizar y mejorar la web, buscar herramientas, librerías o dependencias que solucionen problemas y alivia el código del proyecto.

## Seguimiento de implementación — 30 de septiembre de 2026

### Alcance vigente: simplificación confirmada por el usuario

Esta decisión sustituye las propuestas de cálculo de flujo: Bases es un editor de disposición con etiquetas visuales. Los drones eligen carga y las máquinas eligen un producto de su catálogo, sin filtrar por cintas ni ingredientes recibidos. No se calculan ratios, caudales, déficits, reparto de splitters ni producción. Las cintas y sus animaciones se conservan como dibujo/conectividad del plano, sin significado de transporte real.

El listado izquierdo muestra solo edificios construidos; al entrar desde Planner, Items o Buildings & Recipes añade requeridos frente a construidos por tipo. No enumera piezas seleccionables ni rutas. Se retiran por completo Inventory, búsqueda/localización, el inspector derecho y el marcador secundario de entrada. El selector de producto se abre en modal desde la máquina o el botón Product; los datos ausentes se mantienen ausentes. La geometría, gestos, historial y las métricas energéticas informativas anteriores no cambian.

El seguimiento siguiente es histórico: sus referencias al inspector y marcadores de entrada ya no describen la interfaz vigente.

### Colocación y lectura visual

El Box no ofrece selección de producto ni desde el edificio ni desde Product. Todos los I/O libres de las máquinas quedan grises sin flechas, salvo la cruz de salida bloqueada con F; una cinta conectada determina dirección y color. Los conectores compartidos son 15×9 px (9×15 en laterales), con variante 12×7 px para despejar las esquinas del Box, manteniendo centros, huellas y hit-testing. Dron y splitter conservan sus direcciones fijas.

Cada pasillo tiene candados en ambos laterales, sincronizados sobre el mismo enlace. Los puertos y los terminales libres de cinta comparten marcador y feedback; los extremos de cinta son grises con flecha. El hit-testing reconoce el borde del terminal aunque el cursor caiga en la celda contigua y busca solo las celdas cercanas. F conserva el puerto bajo el cursor al alternar salida, incluso sin cinta: gris habilitado o cruz bloqueada, sin impedir entradas. Las salidas están habilitadas por defecto; tocar una pared arbitraria no conecta una cinta. Clic con mano vacía (o Enter/Espacio en el terminal bajo el cursor) inicia una cinta Mk1; continuar una salida libre de ruta conserva su nivel e identidad.

Paredes y pasillos comparten remates de 3 px y esquinas suavizadas, conservando el margen óptico del suelo y las huellas. La plataforma del dron ocupa las seis celdas de la abertura, termina en sus salidas y tiene raíles abiertos hacia el pasillo. En su pasillo de una celda, el candado se desplaza hacia el lado no construible del dron y queda separado de la pared vecina.

Las conexiones con el dron requieren ahora un hueco de una celda y muestran un pasillo 1×6 (6×1 en vertical), tanto en preview como confirmado. El resto de estaciones mantiene dos celdas de separación. No cambian las aberturas de seis celdas, las huellas ni las salidas; construcción y cintas usan la variante común.

El dron elimina el fondo y marco cuadrado; el cuerpo suaviza sus esquinas sin alterar huella ni salidas. Los previews de estaciones incluyen todos los pasillos propuestos mediante la misma geometría que el plano confirmado, sin mostrar suelo para un preview inválido. El candado queda fuera del pasillo, con 22 px visuales y una zona de clic mayor; no tapa máquinas ni cintas.

Las máquinas asignadas ocultan su botón de añadir producto. El icono queda centrado, limitado a media anchura/altura y 88 px, y deja pasar los gestos de selección/arrastre al edificio sin iniciar arrastre nativo de imagen. Clic derecho en modo Select limpia la etiqueta y restaura el nombre/botón, sin borrar ni mover la máquina; Deshacer recupera el producto. Clic derecho al dibujar, pegar o arrastrar sigue cancelando ese gesto. La barra Product mantiene la alternativa para teclado y táctil. Retomar extremos de cintas ya conectados a máquinas queda pendiente de aclarar si sustituye la conexión o inicia otra ruta desde la salida.

Las estaciones del menú Build usan preview centrado y ajustado a cuadrícula, colocación repetida y cancelación, sin añadirse al abrir la herramienta. El dron admite R/Rotate en preview y colocado: salidas, cara abierta y detección de puertos giran juntos; un enlace bloqueado o pasillo ocupado impide girar. El arte compartido del dron mantiene la extensión de salida detrás del cuerpo, sin líneas naranjas ni un rectángulo superpuesto. Las máquinas muestran el producto principal con un icono grande en lugar de la placa de texto.

Se corrige la unión lateral dirigida: el destino de merge no se incluye como ruta de origen, porque eso se interpretaba como un ciclo y rechazaba la confirmación. Se admite tanto el clic en el lateral como terminar en su celda libre adyacente apuntando directamente hacia él. Las paralelas no se unen y las conexiones cabeza-cola mantienen su comportamiento. Por ahora se conserva la compatibilidad de nivel existente, pendiente de confirmar si deben mezclarse Mk1 y Mk2.

Esta lista conserva el brief original. El alcance confirmado es una herramienta de disposición, no un simulador: la referencia del Planner compara recuentos globales por tipo; las capacidades Mk1/Mk2 son nominales y no calculan carga o déficit de cintas. El dron mide 14×14, no admite construcción interior y tiene dos cargos independientes. Los productos de máquina se derivan de su receta; el marcador elegido solo puede ser una entrada de esa receta.

Las capacidades anteriores tienen implementación en código y su estado se detalla en [la auditoría vigente](../../../docs/base-designer-audit.md), incluida la reorganización, limpieza e interrupción de gestos de BASE-12–16. Las mejoras de cálculo compartido no acreditan todavía rendimiento en bases grandes: BASE-14 necesita un perfil representativo. La validación visual/funcional queda a cargo del usuario, sin tests ni navegador ejecutados en estas tandas. Los valores energéticos no presentes en el catálogo siguen pendientes de datos del juego; no se inventan para cerrar el contador.
