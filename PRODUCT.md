# Product brief

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Main Sequence players planning production chains, gathering construction materials and arranging their bases.

## Product Purpose

Main Sequence Planner helps players understand production chains, collect construction materials and arrange a base. Keep explanations short and distinguish catalog calculations from actual in-game delivery.

## Positioning

A game-specific planning tool grounded in the Main Sequence catalog, connecting production calculations, construction requirements and base layouts. Competitive differentiation has not been validated; do not invent comparative claims.

## Features

- **Planner:** graph and tree views, item demand, compatible recipes, coproducts/recycling and physical building counts. Raw resources remain external inputs by default; players may explicitly choose a real catalog synthesis for supported raw targets or ingredients.
- **Buildings:** cost per building, required quantity, subtotal and combined materials. Unknown costs stay explicit.
- **Items / Buildings & Recipes:** searchable catalog and recipe/research details; stable IDs drive all lookups.
- **Research:** unlock graph and prerequisites.
- **Bases:** stations, machines, directed belts/tunnels, drones, explicit selection, clipboard previews and atomic undo/redo. Confirmed layouts autosave in the current browser; transient gestures/history do not persist. Previous layouts and notes remain untouched in separate legacy storage.

## Operating Context

Players use the browser to inspect the catalog and research, set item demand in Planner, review production and construction requirements, and arrange a base for comparison with the plan.

Bases opens its element catalog in a modal from the left menu. Production is a separate non-modal overlay, initially closed unless Planner comparison is requested; it does not resize the canvas. Items follow Planner stages. Counts and nominal outputs can compare with a plan; they do not prove transport, ingredient coverage or actual production.

## Evidence on Hand

- The committed JSON in [src/shared/data/main-sequence](src/shared/data/main-sequence/) is the catalog source of truth; its [source contract](src/shared/data/main-sequence/README.md) records interpretation and known gaps. Missing costs and energy remain explicit.
- [README.md](README.md) describes existing workflows. [TESTS.md](TESTS.md) records maintained regression coverage and the limits of browser checks. Software tests do not establish actual in-game delivery.

## Product Principles

- Ground calculations in verified catalog records and stable IDs; keep unknown values explicit.
- Distinguish demand, nominal capacity and construction quantities from actual in-game delivery.
- Preserve saved data and accept validated editor operations atomically; keep transient interaction state session-only.
- Keep explanations short and preserve established workflows when improving maintainability.

## Compatibility

Current desktop browsers are the primary target. Navigation, catalog browsing and Planner should remain usable on narrow screens. Bases editing prioritizes desktop pointer use; its canvas does not yet provide complete keyboard or touch editing.

Controls retain keyboard access, visible focus, readable contrast and reduced-motion behavior. Canvas limitations are assessed in audits and may evolve through scoped product changes; this brief does not certify complete accessibility.

## Visual direction

Graphite surfaces, amber actions/selection, restrained category colors, compact corners and Geist typography. Use subtle borders and surface tones, selective depth and readable numeric columns.

Pages use an edge-to-edge shell with padded controls and small section dividers. HeroUI supplies interactive controls; Tailwind handles layout; specific canvas/React Flow artwork stays in CSS. Preserve the established information hierarchy.

Check readable contrast, keyboard focus for controls, responsive behavior and reduced motion. Avoid decorative gradients, nested panels and broad visual rewrites.

## Developer references

- [Repository and domain invariants](AGENTS.md)
- [Bases architecture and state ownership](src/features/base-designer/README.md)
- [Catalog source contract](src/shared/data/main-sequence/README.md)
- [Test contracts](TESTS.md)
