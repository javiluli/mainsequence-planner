# Base Designer: inventario de lo pendiente

Actualizado: **17 de octubre de 2026**. Este es el único inventario de capacidades pendientes del editor Konva. El [README técnico](../README.md) explica su organización; la [matriz de reglas](reglas/README.md) conserva los contratos y decisiones vigentes.

**Una casilla no autoriza su implementación ni fija un orden obligatorio.** La siguiente capacidad y su alcance requieren acuerdo. No recuperar automáticamente arquitectura, gestos o artwork del editor anterior, ni reabrir las auditorías completadas.

## Capacidades y decisiones abiertas

- [ ] **Edificios sobre varias estaciones:** evaluar si una huella puede ocupar suelo de varias estaciones conectadas. Actualmente debe caber en una sola; cambiarlo afecta propiedad, apoyo y persistencia.
- [ ] **Reactor:** consumir Hydrogen Fuel (`T_HydrogenFuel`) y contemplar generación en MJ. Tanto consumo como generación permanecen desconocidos; la receta que fabrica el combustible no establece sus tasas. Semántica aprobada B09/Q1; falta concretar estados y tratamiento de otros productos.
- [ ] **Laboratorios:** definir su función científica antes de implementar consumo, investigación o progreso. Mantienen geometría/puertos y el fallback actual de proveedor desconocido: B10/Q2.
- [ ] **Notas:** crear, editar, mover, copiar, cortar, pegar y borrar individualmente o en conjuntos. Acordar aspecto, tamaño, edición multilínea, legibilidad con zoom y momento de confirmación. Guardar sólo texto confirmado, conservar undo nativo del campo y separar selección de edición. Al girar conjuntos, mantener texto legible; la referencia giraba su posición, no el texto.
- [ ] **Recuperar planos React Flow:** ofrecer conversión explícita de `mainsequence-base-layout` cuando el modelo pueda representar su contenido. Convertir posiciones de estaciones/notas en píxeles y piezas en células locales; conservar IDs, propietarios, notas, recetas, permisos, cargo, vínculos y rutas completas. Informar de contenido no soportado sin descartarlo ni sobrescribir el original. Mantener conversiones probadas de `mainsequence-base-scene` al evolucionar el formato.
- [ ] **Varias bases:** crear, abrir, renombrar, duplicar y eliminar con protección de datos. Ambos editores guardan actualmente una única escena.
- [ ] **Importar/exportar:** copia de seguridad e intercambio mediante archivo versionado y validado. El clipboard de elementos no sustituye esta capacidad.
- [ ] **Asignación global:** decidir si se necesita sustituir cuotas ya aceptadas para maximizar producción. Hoy S20 repartido por splitter deja A10/B10; T20 directo completa A20 y B conserva 10. Obtener A20/B20 requiere otra política y sus pruebas: N07.
- [ ] **Producción aguas arriba parcial:** evaluar propagación cuantitativa por separado. Hoy los dependientes conservan incertidumbre: N08; no se ha certificado la cadena completa de Chromatic Alloy del usuario.
- [ ] **Guía y cierre de la reconstrucción:** redactar la guía de uso junto al usuario, paso a paso sobre comportamientos acordados; comprobar el alcance elegido, recuperación de datos y feedback de uso, marcando capacidades descartadas o pospuestas.
- [ ] **Tutorial interactivo:** iniciativa posterior independiente, sin implementar ni autorizada por esta limpieza.

## Rendimiento pendiente

Las selecciones grandes mantienen pausas demostradas. La medición local del 17-10-2026, con 400 máquinas y 1600 elementos seleccionados, registró aproximadamente 232 ms al cambiar de célula, 305 ms al soltar, 314 ms al montar el portador y 463 ms para pegado completo. Pan al 25 %: p95 34,8 ms y máximo 55,6 ms entre callbacks. No certifica fluidez de ese tamaño, FPS presentados ni latencia física.

- [ ] Si ese tamaño es un requisito, medir por separado validación y montaje/dibujo del portador antes de cambiarlo. Conservar apoyo, rutas, cancelación y una transacción final; no abre otra reorganización general.

La serie previa de 100 ciclos mostró heap JS de 44,0 a 45,9 MiB con meseta final y DOM/listeners constantes. No confirmó fuga en esa serie ni descarta fugas en sesiones largas. Utilización GPU, VRAM, memoria total y latencia física siguen sin medirse. Procedimiento reproducible en el [README](../README.md#rendimiento-y-perfilado).

## Decisiones vigentes

- React Konva posee el canvas; React y HeroUI v2 la interfaz. React Flow sigue en Planner/Research. Se conserva la arquitectura actual y se extraen responsabilidades sólo por necesidad demostrada.
- Conservar aspecto aprobado, cuatro Layers, texturas compartidas, sockets y huellas lógicas. Las próximas capacidades no abren una ronda de rediseño.
- Container identifica ítems recibidos y sus tasas nominales de entrada, participa en el reparto y muestra incertidumbre; no simula inventario ni transferencia entre caras. Sus salidas conservan el fallback de proveedor desconocido, igual que Reactor/labs. Las funciones futuras de estos últimos siguen pendientes.
- Estaciones, logística MK1/MK2, selección, transformaciones, clipboard, recetas/cargos, comparación nominal y persistencia 1–10 ya están implementados. La variante 2×2 B y los nombres históricos se conservan como datos compatibles, fuera de sus antiguos controles.
- No recuperar inspector/panel de permisos, pestaña de producción seleccionada, incidencias/localizar, edición de nombres, contador general, banda temporal ni instrucciones inferiores. Se conservan doble clic para recetas, F contextual incluso durante borradores, C para centrar y giros sucesivos con R.
- La edición completa por teclado y narrow/touch quedó apartada; mantener atajos y controles accesibles. No hay decisión de incorporar backend, nube, simulación, minimapa o colaboración.

## Al incorporar una capacidad

Seguir [AGENTS.md](../../../../AGENTS.md): ampliar sólo contratos necesarios, mantener propuestas separadas de confirmaciones, probar IDs/propietarios/rutas/clipboard/historial/guardados y cancelaciones/no-ops. Verificar el flujo real, foco, narrow y movimiento reducido donde corresponda. Medir problemas reproducibles antes de añadir índices, cachés o capas; documentar propósito y decisiones en código y referencias existentes.

Al completar una capacidad, retirar su pendiente y actualizar README/reglas. La implementación anterior sigue en `34de597061bfa96308c85af0a60d8368fb81c1f5`; consultarla sin cambiar de rama:

```sh
git show 34de597:src/features/base-designer/model/catalog.ts
git show 34de597:src/features/base-designer/lib/layout/placement.ts
git show 34de597:src/features/base-designer/lib/routes/underground.ts
git show 34de597:src/features/base-designer/ui/dialogs/machine-item-modal.tsx
git show 34de597:src/store/base-designer/types.ts
```
