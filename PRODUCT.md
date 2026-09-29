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
- Las cintas contiguas solo se unen cabeza-cola. Su movimiento visual se activa únicamente en caminos dirigidos completos entre una salida y una entrada de máquinas; no implica una simulación de recursos o rendimiento.
- Un clic en el I/O de una máquina ancla la ruta de cinta en la celda libre exterior; un clic en el I/O de destino la termina y orienta el último tramo hacia la máquina.
- Cada ruta confirmada conserva una identidad única: seleccionar, desplazar o borrar un tramo actúa sobre la ruta completa y mantiene su forma.
- La paleta de bases se abre en un modal compacto por secciones; el clic central sobre una pieza recupera su herramienta. Los controles del lienzo incluyen selección, deshacer/rehacer, copiar/pegar, rotar y borrar. Una ruta de cinta puede ampliarse y atravesar estaciones alineadas sin perder su identidad. Las métricas de energía distinguen valores conocidos de datos todavía no extraídos del juego.
- Las estaciones se acoplan solo cuando coinciden las aberturas; las unidas se arrastran juntas. Las franjas de puerta admiten piezas y una máquina puede cruzar la junta como un único elemento. Un enlace ocupado entre dos estaciones impide borrar cualquiera de ellas; copiar un módulo aislado omite las piezas compartidas. Una ruta de cinta que cruza módulos conserva una única identidad para selección, movimiento y borrado.
- El prototipo conserva el diseño solo durante la sesión actual del navegador; no debe guardarlo de forma permanente todavía.
- No se deben inventar recetas, edificios de producción ni relaciones de investigación ausentes del catálogo.

## Evidence on Hand

- Catálogo generado: `src/shared/data/main-sequence/`.
- Iconos exportados: `public/assets/icons/`.
- Medidas iniciales y método de trazado de cintas: indicaciones directas del usuario en esta tarea.

## Product Principles

- Priorizar la fidelidad a los datos del juego y distinguirla de las medidas aún provisionales.
- Hacer rápidas las operaciones repetitivas de planificación y colocación.
- Mantener una arquitectura por features que permita ampliar el prototipo sin romper el planner existente.
