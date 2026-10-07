# Repository Guidelines

## Project structure

This Vite, React and TypeScript application follows a feature-first structure.

- Route-level composition belongs in src/pages/.
- Product code belongs in src/features/<feature>/.
- Reusable domain-neutral UI and helpers belong in src/shared/.
- Zustand stores live in src/store/.
- Routing lives in src/router/.
- Application shells live in src/layouts/.
- Game data crosses the application boundary through src/shared/data/.

Active product features are Planner, Items, Buildings & Recipes, the Research graph and the Bases layout prototype. Research metadata also integrates into existing recipe flows.

Feature root index.ts files define public APIs. Consumers outside a feature should use that API rather than private implementation paths.

Dependency direction is deliberately small:

- pages and layouts may compose feature public APIs and shared modules;
- features may use their own internals and shared modules; cross-feature imports go through the target feature's root API;
- shared modules must not depend on pages, stores, layouts or product features;
- `src/store/<feature>.store.ts` and optional `src/store/<feature>/` action/storage modules form a feature-state adapter: it may depend on that feature's domain modules and shared data, but not on another feature's private code or UI; only its owning feature consumes it in production;
- domain calculations and transformations stay in feature `lib/` or `model/` modules rather than React components, and must not import UI, hooks or stores.

Keep root APIs narrow. A module becomes shared only after it is genuinely domain-neutral and reused; do not move code to `shared/` in anticipation of reuse. The optional local `scripts/check-architecture.mjs` checks these import boundaries, including relative and literal dynamic imports; it is ignored in Git and unavailable in a fresh checkout.

## Data policy

The game catalog is content, not mutable application state.

The committed files in `src/shared/data/main-sequence/` are the Main Sequence single source of truth. `items.json`, `buildings_and_recipes.json` and `research.json` are generated from the FModel export and consumed through `src/shared/data/index.ts`.

Agents must:

- never create a second editable catalog;
- never modify source JSON to compensate for a UI problem;
- normalize and validate data at the boundary;
- derive lookup indexes from source data;
- preserve stable IDs;
- treat names as display data, not foreign keys;
- avoid inventing missing game records.

Only source `Crafter` records may appear as production buildings. Raw resources are external/infinite inputs in the planner and must never be represented by synthetic `_supply` machines. Real ore-synthesis recipes remain attached to their source crafter.

An item without a standalone recipe remains a normal external-input leaf in every planner view, even if it is also a coproduct elsewhere. This preserves known recipe chains without inventing a machine or blocking the graph. Only genuinely invalid rates or circular dependencies prevent calculation.

Energy-use values come from `Buildable.ItemDetails` entries whose detail key is `ConsumePower`; the game's displayed unit is MJ. A missing value means unknown, not zero. Do not change the total-energy formula without confirming whether the game scales consumption with machine utilization.

`scripts/build-main-sequence-catalog.mjs` is an optional local maintenance tool for game updates, ignored in Git and absent from fresh checkouts, not a runtime dependency. Keep stable IDs because they are also used by exported icon mappings. Update presentation aliases instead of changing gameplay IDs to fit filenames.

Do not introduce a database unless the product requirements later establish a real need for one.

## Build, test and development

Use Node.js 24.20.0 and pnpm 11.19.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

These are the authoritative current checks. Do not claim browser E2E coverage until a real Playwright suite exists.

## Coding style

Prettier is the formatting source of truth: two spaces, single quotes, no semicolons, trailing commas and a 140-character line limit.

Use function components and explicit TypeScript contracts. Keep calculations and domain transformations in feature lib/ modules.

Comments should explain non-obvious invariants, intent or trade-offs. Do not preserve migration history in code comments when documentation is a better place.

## Architecture principles

Prefer:

- clarity over abstraction;
- feature ownership over premature sharing;
- derived state over duplicated state;
- stable IDs over positional relationships;
- small reversible changes over broad rewrites.

Do not refactor merely for aesthetic reasons. Every structural change should improve maintainability, consistency, extensibility, performance or robustness.

For Bases, keep node contracts in `features/base-designer/model/station-node.ts`, grid pointer/command gesture state in `ui/nodes/use-station-interactions.ts`, right-drag panning in `ui/canvas/use-canvas-pan.ts`, and independent movement/build/paste sessions in `ui/placement/`. Keep numeric coordinate projection and hit-testing in `lib/geometry/station-spatial.ts`, world/local projection and floor ownership in `lib/layout/world-layout.ts`, piece validation in `lib/layout/placement-validation.ts`, and route validation in `lib/routes/route-validation.ts`. Validators depend on projection, never the reverse; consume their concrete modules without reexport facades. Derive the world render snapshot once with `lib/layout/layout-view.ts`, memoized by stations in the parent; reuse it and the route preview in every node. `ui/canvas/use-canvas-nodes.ts` adapts controlled nodes and retains note measurements, forwarding selection to its explicit owner. `ui/canvas/base-canvas.tsx` composes React Flow, overlays and the single capture surface; gesture sessions remain in their hooks. Node renderers live in `ui/nodes/`; pure layout ghost geometry lives in `lib/clipboard/clipboard-preview.ts`, with artwork in `ui/placement/layout-paste-preview.tsx`. Visual insets must never change logical cell footprints. Confirmed layouts and notes autosave locally through the versioned, validated Bases storage adapter; the 50-entry undo history, clipboard and previews remain session-only; cancel transient captures/movement before switching editing context. Do not claim large-layout performance without a representative measured profile.

Bases selection is explicit in `model/editor-selection.ts` and owned by `ui/selection/use-editor-selection.ts`: React Flow node highlights and clipboard reads must consume it, not the active editing station. `lib/geometry/selection-geometry.ts` resolves world-cell area intersection and complete route identities; grid capture and thresholds remain in the interaction hook. `ui/commands/use-selection-commands.ts` owns clipboard and pending Cut/Delete confirmation, while `ui/commands/use-editor-commands.ts` dispatches toolbar/keyboard commands. `lib/clipboard/clipboard.ts` snapshots only the selected stations/notes and complete contents inside their boundary, preserving relative positions and internal locks; omit whole external routes/parts with a notice, never auto-expand node selection. Clipboard previews are canvas-level and repeat until canceled. `lib/clipboard/clipboard-operations.ts` validates complete paste proposals before consuming the store's explicit ID allocator; the store records one undo entry. Cut publishes clipboard only after accepted deletion, including confirmation against current committed contents. Do not restore immediate station/note cloning or per-node paste ghosts.

Bases movement remains a UI-only proposal until release. `lib/layout/layout-transform.ts` owns grid-preserving quarter turns and delegates floor/route validation to the existing domain. Keep a fixed pivot through each gesture, rotate complete routes and directional metadata together, and include linked modules when moving their floor. The store commits one validated transaction; invalid release, cancellation and round trips add no undo entry. Wheel rotates only an active canvas preview, leaving normal zoom and form controls alone. Notes remain upright. Never persist transient world `stationId` metadata inside local placements.

Bases route drawing lives in `ui/routes/use-route-drawing.ts`: node callbacks supply station-local cells, while draft anchors and route previews use world cells. BaseDesigner coordinates tool changes and pointer/cancellation priority. `lib/routes/route-operations.ts` constructs validated route proposals and prunes disconnected lateral junctions; its explicit ID allocator belongs to the store and is called only after validation, before one history transaction. Keep anchor geometry and tunnel limits in `lib/routes/route.ts` and `lib/routes/underground.ts`. Right-click removes one anchor, including the start; Escape cancels the whole draft and right-drag only pans. Empty-hand continuation starts normal MK1; merge only normal routes of the same type, keeping other tiers and tunnels independent. Underground routes expose only their first input and last output; buried cells stay out of surface occupancy but may select the complete route when no surface part is present. Delete follows selected IDs, never coordinates. Drone nodes own their corridor locks and keep ports above adjacent floors; automatic selection elevation must not override that layering.

Directed connectivity lives in `lib/connections/connections.ts`, port geometry/directions in `lib/connections/ports.ts`, and derived animation phases in `lib/connections/belt-flow.ts`. Keep forward animation paths separate from upstream product tracing; both consume the same directed rules. Machine I/O automatically supplies adjacent normal MK1/MK2 belts on aligned lateral faces; derive these inputs without persisting automatic junctions. Belts pointing into machines remain inputs, and F disables only outgoing delivery. Keep artwork, animation and upstream product tracing consistent; tunnels and splitters retain their explicit ports.

Bases products stay derived: `lib/products/machine-inputs.ts` traces known upstream labels through valid directed connections, including drone cargo, containers and complete tunnels, with visited IDs to stop cycles. Filter recipes by the union of known inputs; no known inputs means the full compatible catalog. New assignments use a matching recipe; preserve the current alternative when relabeling the same product and never clear assignments on connection changes. Reactor/storage have no product selector. `lib/products/plan-comparison.ts` keeps net Planner targets separate from gross full-speed catalog output, including coproducts before recycling. Neither figure proves delivery or ingredient coverage; never invent rates for drones or recipes for unavailable machines.

Bases controls live in `ui/controls/base-toolbar.tsx` (both rows, shared commands and derived energy) and `ui/controls/base-buildings-panel.tsx`. `ui/dialogs/use-editor-dialogs.ts` owns palette/product/drone/output target IDs and focus restoration, deriving entities from the current confirmed layout without permission/product snapshots. It prepares the editing context through the parent callback before opening; the parent keeps global cancellation/rotation/history arbitration. `ui/dialogs/editor-dialogs.tsx` composes the existing focus scopes and receives Cut/Delete confirmation from useSelectionCommands; it owns no second modal state. Keep catalog mapping, upstream labels, recipes and informational Planner comparison together in `lib/products/`, without UI/store imports. Bases counts default open and toggle from a centered left-edge canvas button in a floating non-modal overlay panel, sliding left to right and respecting reduced motion. It stays open during canvas editing without resizing React Flow; Escape inside the panel or its close control restores trigger focus. Green/amber comparisons represent built counts and nominal capacity, not actual belt delivery. Machine/drone item pickers accept or clear immediately; retain keyboard-accessible Clear alongside contextual clearing. Empty unlocked station deletion still delegates validation to the store; cargo counts as contents. Storage failures may show a compact alert beside the toolbar; there is no canvas footer, status region or operation-notice state: do not restore them. Keep validation in the domain and invalid-preview feedback in the artwork; clipboard omissions remain described on the paste control. There is no Erase tool or removeAt action: Delete and the toolbar remove selected IDs through removePlacements, preserving whole routes across modules. Do not restore coordinate-based deletion.

## Visual direction

Bases tile wrappers live separately in `ui/artwork/belt-tile.tsx` and `ui/artwork/machine-tile.tsx`; shared port marks live in `ui/artwork/port-marker.tsx` and station frames/drone artwork stay together in `ui/artwork/station-artwork.tsx`. Consumers import these concrete modules, not reexports from nodes. Import feature CSS once through `styles/base-designer.css`: stations, placements and ports precede root-scoped tokens, React Flow overrides and final reduced-motion rules. Preserve precedence within each domain, including route join hints before shared I/O and splitter role states afterwards. Bases belt SVG belongs in `ui/artwork/belt-artwork.tsx`; `lib/connections/belt-flow.ts` extends only confirmed flow phases to buried artwork, derived once in the parent. Never add buried cells to the surface occupancy index just to animate them. Belts use a darker steel tone than machines. Tunnel mouths are simple half-cell covers; clip belt paths at the lip so flow cannot emerge on the buried side. Buried paths retain almost the surface belt thickness with lower opacity, not a thin line. I/O marks stay compact and share dimensions and chevrons across machines, splitters and drones; connected marks retain their complete frame, with the approaching belt covering only its outer half. Keep the inner frame and disabled-output feedback visible. Nameplate font size must not depend on machine footprint. Do not restore decorative machine fasteners, nested panels or white hover outlines.

The current visual identity uses graphite surfaces, amber action/selection accents, restrained category colors, compact corners and Geist typography. It takes its industrial tone from the game's interface without copying game screens literally.

Visual work is incremental. Preserve information architecture and existing interaction patterns unless a concrete usability issue justifies a change.

Impeccable is opt-in: use it for explicit UI/UX design, critique or polish work when it adds value. Do not apply it automatically to unrelated code edits.

Depth is subtle and selective. Prefer borders and surface tones over shadows. Avoid broad gradients, glassmorphism, decorative animation and excessive variants.

The main product pages use an edge-to-edge shell: no outer page margins, internally padded headers and controls, and subtle dividers between sections. Keep HeroUI as the base for interactive controls, dialogs and popovers.

Check keyboard focus, reduced motion, responsive behavior and readable contrast as part of UI work.

## Skills

Installed skills are supporting references, not authority over repository requirements.

Precedence is:

1. current repository instructions;
2. library/version contracts and measured evidence;
3. task-specific domain skills;
4. generic recommendations.

Use only skills relevant to the task. Do not invoke overlapping skills merely because they are installed.

Core workflow skills:

- TypeScript/React best practices;
- systematic debugging;
- Vitest;
- verification before completion.

Opt-in workflow skills:

- Impeccable for visual work;
- web quality/performance skills for audits;
- Playwright skills when an active browser suite exists.

## Testing

Vitest tests live in `test/`, mirroring the relevant `src/` feature or shared-data path. Keep production modules in `src/` and test-only files in `test/`.
Catalog integrity inspectors live in `test/shared/data/`; they are not part of the runtime data boundary.

Tests should protect real behavior. Do not add artificial assertions only to increase coverage and do not weaken/delete useful regression tests to make CI green.

When the data model changes, replace obsolete source-specific fixtures together with the affected behavior. Catalog tests must reject synthetic buildings, dangling item references and invalid rates.

## Release verification

Before merging meaningful changes, run the authoritative formatting, lint, test and build commands.

For browser-visible changes, also verify the affected workflow in a real browser before claiming visual correctness.

## Change discipline

For broad changes:

1. identify the concrete problem;
2. explain or document the cause;
3. verify dependencies and impact;
4. make the smallest safe change;
5. run focused validation;
6. update documentation when the current contract changes.

Never perform mass renames or delete potentially referenced code without checking references first.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
