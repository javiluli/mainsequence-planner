# Product brief

Main Sequence Planner helps players understand production chains, collect construction materials and arrange a base. Keep explanations short and distinguish catalog calculations from actual in-game delivery.

## Features

- **Planner:** graph and tree views, item demand, compatible recipes, coproducts/recycling and physical building counts. Raw resources remain external inputs.
- **Buildings:** cost per building, required quantity, subtotal and combined materials. Unknown costs stay explicit.
- **Items / Buildings & Recipes:** searchable catalog and recipe/research details; stable IDs drive all lookups.
- **Research:** unlock graph and prerequisites.
- **Bases:** stations, machines, directed belts/tunnels, drones, notes, explicit selection, clipboard previews and atomic undo/redo. Confirmed layouts autosave in the current browser; transient gestures/history do not persist.

The Bases Buildings/Items panel opens by default as a floating non-modal overlay. It stays open during editing without resizing the canvas. Items follow Planner stages. Counts and nominal outputs can compare with a plan; they do not prove transport, ingredient coverage or actual production.

## Visual direction

Graphite surfaces, amber actions/selection, restrained category colors, compact corners and Geist typography. Use subtle borders and surface tones, selective depth and readable numeric columns.

Pages use an edge-to-edge shell with padded controls and small section dividers. HeroUI supplies interactive controls; Tailwind handles layout; specific canvas/React Flow artwork stays in CSS. Preserve the established information hierarchy.

Check readable contrast, keyboard focus for controls, responsive behavior and reduced motion. Avoid decorative gradients, nested panels and broad visual rewrites.

## Developer references

- [Repository and domain invariants](AGENTS.md)
- [Bases architecture and state ownership](src/features/base-designer/README.md)
- [Catalog source contract](src/shared/data/main-sequence/README.md)
- [Test contracts](TESTS.md)
