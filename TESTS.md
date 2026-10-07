# Pruebas

Vitest protege cálculos, integridad del catálogo y regresiones que una validación manual repetida no cubre de forma fiable. Los archivos viven en `test/`, reflejando la propiedad de `src/`; los inspectores de catálogo son auxiliares de pruebas y no entran en el runtime.

## Qué conservar

- **Catálogo:** IDs y referencias válidas, crafters reales, ratios positivos, cantidades de construcción y dependencias de investigación.
- **Planner:** demanda recursiva, redondeo de máquinas físicas, energía desconocida, suministro externo, alternativas de receta, coproductos, reciclaje y costes de construcción.
- **Bases:** geometría, rutas completas, puertos dirigidos, selección explícita, clipboard, pivotes, validación de propuestas e historial atómico. La persistencia protege recarga completa, IDs, datos dañados/versionados y fallos de storage. Son invariantes distintas aunque compartan fixtures.
- **UI y estado:** sólo comportamientos relevantes, como hidratación de recetas/suministros, cancelación de capturas, lazy loading, fallback de iconos y recuperación de rutas.

No crear pruebas de wrappers triviales, composiciones artificiales, clases CSS o duraciones exactas de animación. Preferir escenarios con resultados observables y reutilizar una suite existente cuando protege la misma responsabilidad. Las regresiones útiles no se eliminan por ser específicas ni para conseguir un resultado verde.

## Ejecución

```powershell
pnpm test
node node_modules/vitest/vitest.mjs run test/features/planner/lib/building-construction-cost.test.ts
```

Antes de integrar cambios relevantes, ejecutar además `pnpm format:check`, `pnpm lint` y `pnpm build`. Para cambios visibles, comprobar el flujo afectado en navegador, incluido un viewport estrecho y reduced motion cuando aplique.

El chequeo de arquitectura sólo está disponible como herramienta local opcional: `node scripts/check-architecture.mjs`. No forma parte de un checkout nuevo ni de CI.

No hay dependencias, configuración ni suite Playwright en el proyecto. La automatización puntual de navegador sirve para revisar flujos y aspecto, pero no acredita cobertura E2E repetible ni sustituye los cálculos de Vitest. Incorporar una suite de navegador sólo si un flujo crítico justifica su mantenimiento.
