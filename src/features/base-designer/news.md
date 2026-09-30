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

Esta lista conserva el brief original. El alcance confirmado es una herramienta de disposición, no un simulador: la referencia del Planner compara recuentos globales por tipo; las capacidades Mk1/Mk2 son nominales y no calculan carga o déficit de cintas. El dron mide 14×14, no admite construcción interior y tiene dos cargos independientes. Los productos de máquina se derivan de su receta; el marcador elegido solo puede ser una entrada de esa receta.

Las capacidades anteriores tienen implementación en código y su estado se detalla en [la auditoría vigente](../../../docs/base-designer-audit.md), incluida la reorganización, limpieza e interrupción de gestos de BASE-12–16. Las mejoras de cálculo compartido no acreditan todavía rendimiento en bases grandes: BASE-14 necesita un perfil representativo. La validación visual/funcional queda a cargo del usuario, sin tests ni navegador ejecutados en estas tandas. Los valores energéticos no presentes en el catálogo siguen pendientes de datos del juego; no se inventan para cerrar el contador.
