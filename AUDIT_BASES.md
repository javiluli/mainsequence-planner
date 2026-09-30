# Auditoría del diseñador de bases

> **Documento histórico — 28 de septiembre de 2026.** Conserva la evidencia y los hallazgos de aquella versión; no acredita el código actual. El seguimiento vigente, las correcciones posteriores y la validación manual pendiente están en [docs/base-designer-audit.md](docs/base-designer-audit.md). Las comprobaciones en navegador descritas aquí no se han repetido durante BASE-00–16.

28 de septiembre de 2026. Alcance: `/bases`, el catálogo de piezas, la geometría, las rutas, el store y la interacción. Es una auditoría del prototipo, no una certificación del juego completo ni de toda la web.

## Contrato actual

- Las estaciones 1×1 tienen una huella edificable de **14×14** celdas y las 2×2 de **30×30**. Toda la huella es suelo edificable; el marco decorativo sobresale ligeramente y las baldosas y los cuerpos de los edificios llevan un margen óptico pequeño sin reducir sus huellas lógicas. Una puerta ocupa seis celdas de ancho; dos puertas alineadas con un hueco de dos celdas entre estaciones generan un pasillo construible **2×6**. La 2×2 tiene dos puertas por lado.
- Las estaciones se colocan en la cuadrícula, sin imán. Solo puertas completas alineadas a dos celdas de distancia forman suelo compartido. Una pieza sobre el pasillo vincula físicamente los módulos: se trasladan juntos y no se puede retirar uno mientras la pieza dependa de ambos.
- Un edificio puede ocupar celdas de varias estaciones. Cuando se traslada completamente a otra, cambia de propietario sin cambiar su identidad ni su posición mundial.
- Una ruta se confirma como una sola entidad aunque atraviese varios módulos. Se puede extender desde un extremo libre, y su selección, movimiento y borrado afectan a toda la ruta. La animación solo aparece en un camino dirigido completo entre máquinas; el resto es carril vacío. El divisor muestra una entrada turquesa y tres salidas ámbar.
- El menú compacto muestra miniaturas de la pieza y secciones buscables. Un clic central sobre una pieza recupera su herramienta. El estado existe solo durante la sesión de la página.

## Evidencia y límites

- Revisión estática de `model/catalog.ts`, `lib/{stations,placement,world-layout,route,connections,ports}.ts`, `store/base-designer.store.ts` y los componentes/CSS de Bases.
- En un navegador real se colocaron dos estaciones 14×14 y se alinearon manualmente dejando dos celdas entre ellas. El pasillo apareció visualmente, permitió iniciar y confirmar una cinta hasta el segundo módulo y aceptó un contenedor 2×2 en sus dos columnas. En una revisión anterior se comprobaron la extensión, selección y movimiento completo de una ruta de 15 celdas, la conexión al divisor y el clic central para recuperar la herramienta; esos detalles no se han repetido con la nueva geometría.
- En una revisión anterior se colocó una refinería sobre la unión y se arrastró al segundo módulo; el edificio completo permaneció visible y cambió de propietario. El traslado sobre el nuevo pasillo de dos celdas aún requiere una comprobación específica.
- TypeScript, ESLint de la sección e Impeccable detector terminaron sin hallazgos; Vite compiló la aplicación. El build avisó de un chunk compartido de 734 kB sin comprimir, mientras que el chunk específico de Bases quedó en 45 kB. Es una señal para medir carga inicial de toda la web, no una regresión atribuible automáticamente a esta página. Prettier se aplicó a los documentos nuevos.
- No se ejecutó la suite de tests, siguiendo la petición previa de no hacer pruebas. No se ha medido carga con cientos de estaciones, contraste con instrumento, interacción táctil real ni equivalencia de cada huella con una nueva exportación del juego.

## Hallazgos por prioridad

| Prioridad | Área              | Hallazgo e impacto                                                                                                                                                                                            | Acción recomendada                                                                                                                |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P1        | Accesibilidad     | El lienzo permite navegar celdas con teclado, pero las piezas y sus puertos no son objetos independientes en el orden de tabulación ni tienen una lista equivalente para lector de pantalla.                  | Añadir inventario accesible sincronizado con la selección, acciones por pieza y anuncios de colocación inválida.                  |
| P1        | Edición de grupos | Copiar una estación omite expresamente piezas compartidas. El comportamiento evita copias inválidas, pero no permite duplicar una base conectada completa.                                                    | Introducir una operación de copia de grupo con coordenadas de mundo y remapeo de IDs; no copiar fragmentos silenciosamente.       |
| P2        | Rutas             | El trazador usa segmentos ortogonales horizontales primero y no deja mover anclas tras confirmar. Para recorridos densos hay que deshacer/redibujar; la unión de rutas solo se ofrece en extremos libres.     | Añadir edición de anclas/segmentos y feedback de conexión, manteniendo la identidad de ruta.                                      |
| P2        | Flujo del divisor | El análisis de conectividad activa el divisor cuando existe un camino completo, pero la representación no distingue qué salida de sus tres ramas está activa.                                                 | Calcular actividad por cara y animar únicamente cada rama conectada; verificar la regla real del juego antes de simular caudales. |
| P2        | Escalabilidad     | `routeCellOwner` recorre conectividad por celda, la ocupación y el flujo se reconstruyen al editar, y el historial guarda hasta 50 instantáneas enteras. En bases grandes el arrastre puede sufrir.           | Medir con un diseño grande; después indexar suelo/piezas por región y reducir copias de estado si hay evidencia de lentitud.      |
| P2        | Energía           | El JSON confirma consumo solo para algunos edificios de esta paleta. El reactor y otros carecen de valor de energía verificable. El contador usa límite inferior o raya, no «unknown» ni un número inventado. | Extraer datos del juego cuando estén disponibles; separar claramente energía producida y requerida.                               |
| P2        | Móvil/táctil      | El modal se adapta, pero los controles superpuestos del flow y los puertos son compactos; clic central y arrastre precisan ratón.                                                                             | Aumentar áreas de interacción y definir gestos/alternativas táctiles antes de prometer soporte móvil completo.                    |
| P3        | Mantenibilidad    | `station-node.tsx` concentra dibujo, hit-testing de puertos, previsualización y gestos. La lógica de geometría sí está separada en `lib/`.                                                                    | Extraer interacciones o vistas solo cuando haya otro caso de uso claro; evitar una división estética que disperse invariantes.    |

## Lo corregido en esta iteración

- Geometría corregida a 14×14 y 30×30 exteriores, con suelo construible hasta las paredes y un margen visual en el marco. El pasillo de dos celdas entre puertas alineadas es suelo real del editor: admite máquinas, cintas y rutas entre módulos; las paredes cerradas siguen bloqueando el paso.
- Retirado el acoplamiento magnético: estaciones cercanas pero separadas no comparten suelo. Una unión ocupada sí mantiene juntos los módulos al moverlos.
- Las rutas atraviesan estaciones conectadas y pueden ampliarse como una sola entidad editable; moverlas o borrarlas afecta a todos sus tramos.
- El edificio trasladado al módulo vecino se dibuja sin recortes y cambia de propietario cuando su origen entra en él. La selección cian usa un borde interior.
- Puertos del divisor diferenciados y utilizables como inicio o destino según su dirección. Menú de construcción compacto con miniaturas y búsqueda; clic central para recuperar herramientas.
- Sustituida la cadena «unknown» del contador de energía por una presentación de total confirmado o límite inferior, con el detalle incompleto en el tooltip.

## Siguiente iteración

Priorizar accesibilidad e inspección de rutas densas. Antes de optimizar el store, obtener una medición con una base representativa; antes de completar energía o caudales, verificar nuevos registros en la fuente del juego. Mantener el modelo de sesión hasta que el producto pida guardado/exportación.
