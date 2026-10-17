# Project contract

Main Sequence Planner helps players calculate production chains, inspect the game catalog and arrange bases.

## Scope and judgment

- Complete the requested work, including relevant verification. Make directly necessary refactors autonomously when they have a concrete benefit. Propose broader reorganizations, changes across feature boundaries or public-contract changes before implementing them, unless already authorized by the task.
- Reuse existing capabilities when they fit. Keep new code with its feature; share it only when it is domain-neutral and actually reused. Extract abstractions or split files for a demonstrated responsibility or maintenance problem, not a line-count target.
- Propose new runtime dependencies, major upgrades or changes to framework/storage architecture before implementing them. Small development tools directly needed by the task may be added with justification, without introducing services or recurring costs. A backend or database requires a concrete product need.
- Preserve established behavior during implementation. In audits, distinguish intended decisions, current implementation and verified problems; existing rules and structure may be questioned with evidence. Update affected documentation when behavior, ownership or maintenance procedures change.

## Architecture

- Pages and layouts compose feature public APIs and shared modules. Product code belongs in `src/features/<feature>/`; route definitions remain in `src/router/`.
- Outside a feature, use its root `index.ts` API. Keep that API narrow. Its owning store and tests may access the relevant internals.
- `src/shared/` must remain independent of features, stores, pages, layouts and routing.
- `src/store/<feature>.store.ts` and optional action/storage modules are that feature's state adapter. They may depend on its domain and shared data, not UI or another feature; only the owning feature consumes them in production.
- Keep domain calculations and transformations in feature `lib/` or `model/` modules, independent of UI, hooks and stores. Prefer derived results over duplicated state; keep transient interaction state with its explicit UI owner.
- Follow the configured TypeScript, ESLint and Prettier contracts.

## Code documentation

- Give non-trivial project functions, hooks, components, utilities, callbacks, types and abstractions a brief explanation of purpose and responsibility. Prefer JSDoc/TSDoc where appropriate; explain rationale, inputs, outputs and constraints when not evident. Use `@param` and `@returns` when they add context beyond types and names.
- Scale detail with complexity and API importance, especially for public/shared APIs, reusable components, domain logic, algorithms and internal APIs used across modules. Treat obvious local callbacks and trivial private helpers proportionally. Avoid comment quotas, repeated signatures and narration of evident code; inline comments explain non-obvious invariants, intent or trade-offs.
- Keep documentation synchronized with significant behavior or API changes. Necessary code documentation is part of completion for new code.

## Game data and calculations

- The committed JSON in `src/shared/data/main-sequence/` is the catalog source of truth, consumed through `src/shared/data/index.ts`. Normalize and validate at the boundary; derive indexes. Do not create another editable catalog or change source data to fix presentation.
- Preserve stable IDs across data, saved state and icon mappings. Names are display data. Do not invent records, recipes, rates, research relationships or missing values; unknown energy and construction costs remain explicit.
- Production buildings must correspond to source Crafter records. Raw resources terminate as external inputs unless a real catalog recipe is explicitly selected; never synthesize supply machines.
- Demand without a standalone recipe remains an external input after verified coproduct allocation. Missing recipes alone do not invalidate a plan; preserve rate and cycle validation.
- Recipe and supply rates are items/min; construction quantities are item units. Keep the game's MJ energy convention. Changing energy aggregation or utilization scaling requires verified game evidence.
- Bases compares built counts and nominal catalog capacity with Planner requirements. These figures do not establish transport, ingredient coverage or actual production. Do not invent drone throughput.

## Editor and saved data

- Bases gestures produce proposals; the store validates against the committed layout and accepts one atomic transaction. Canceled, invalid or unchanged proposals add no undo entry. Allocate new IDs only after validation.
- Keep selection distinct from editing context. Operations follow explicit IDs and preserve complete routes, linked contents and coordinate ownership. Visual geometry must not alter logical footprints.
- Persist only confirmed Bases layouts and notes. Selection, clipboard, previews and undo history remain session-only; cancel transient gestures before changing editing context.
- Preserve existing saved data when models or formats change: provide and test the necessary conversion, retain unreadable data and avoid silent resets. Indefinite support for every historical format is not required.

## Base Designer maintenance

- Apply this protocol to Bases, its store and affected dependencies/tests. Read the relevant current decisions in its README and [existing inventory](src/features/base-designer/docs/ideas-pendientes.md); completed audit phases are the baseline, and pending ideas do not authorize implementation.
- Before editing, locate the implementation, entry points, consumers, reusable domain logic and related tests. Identify affected contracts, invariants and edge cases. Keep simple fixes local; expand analysis across relevant dependencies for routes, geometry, state or complex gestures. Repeat a full audit only for an exceptional, stated technical reason.
- Keep strict TypeScript contracts: prefer inference and narrowing over `any` or unchecked assertions; treat external data as `unknown` until validated. Do not weaken types to make a change compile.
- Extend existing typed definitions for shared domain rules. Logistics levels belong in `src/features/base-designer/model/logistics.ts`; use verified catalog properties where available, never infer capacity from ID suffixes or duplicate variant lists. New levels need verified data and tests for any distinct behavior. Legitimate local visual/interaction values need no global configuration.
- Fix a bug's cause and add a regression test when viable. For an intentional behavior change, identify the superseded contract and adapt its tests. Trace relevant consequences through selection/transforms, clipboard/history, routes/ports, recipes/drones, statistics/Planner, persistence and canvas events; exercise cancellation, invalid proposals and no-ops where affected.
- For routing, geometry, rendering or intensive calculations, assess cost and invalidation in frequent pointer, drag and zoom paths. Keep confirmed-scene analysis and persistence out of per-event/frame work. When risk or an optimization warrants measurement, reuse representative fixtures and the existing profiling procedure; compare equivalent scenarios before/after rather than adding speculative caches.
- Classify multiple requests as bugs, behavior changes or new capabilities; resolve dependencies/conflicts and group related work into reviewable changes. For large tasks, propose phases and implement only the agreed phase. Delegate only useful independent or specialist work; trivial changes need no subagents.
- Before delivery, review the changed code and affected consumers/tests for scope, reuse, ownership, shared rules, necessary comments, regressions and avoidable complexity; resolve findings locally. Report changes, relevant decisions, actual checks and remaining risks briefly. Update existing tracking/documentation when scope warrants it; do not create a report for each small change.

## UI and compatibility

- Use HeroUI v2 for interactive controls and preserve the Tailwind CSS v4 integration. Follow existing theme and shared UI primitives.
- Preserve graphite surfaces, amber actions/selection, Geist typography, compact corners and subtle depth. Local usability improvements are allowed within scope; propose changes to workflows, tools, information architecture or visual identity before implementing them.
- Prioritize current desktop browsers. Keep navigation, catalog and Planner usable on narrow screens; Bases editing prioritizes desktop pointer use. Maintain keyboard access to controls, readable contrast and reduced motion. Document and assess canvas limitations rather than claiming complete accessibility.

## Validation

Use Node from `.nvmrc` and pnpm from `package.json#packageManager`. Install with `pnpm install --frozen-lockfile` when setup is needed; develop with `pnpm dev`.

- During implementation, run checks relevant to the change. Add or update tests for meaningful behavior and regressions; preserve useful tests and update obsolete fixtures with the affected contract.
- Before presenting a code change as ready to integrate, run:

```sh
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

- For browser-visible changes, exercise the affected workflow in a real browser; check focus, narrow layouts and reduced motion where relevant. Distinguish one-off browser checks from maintained automated coverage.
- For changes affecting Bases browser workflows, also run `pnpm test:e2e`. Install its pinned Chromium with `pnpm exec playwright install chromium` when needed; CI installs Linux system dependencies too. Keep domain matrices in Vitest and use the small E2E suite for native canvas input, dialogs and recovery.
- For documentation-only changes, verify accuracy, references and formatting; product tests are needed only when implementation is affected.
- Tests belong in `test/`, mirroring feature/shared ownership. Report what was verified and any limitations. Performance claims require representative measurements; optimize reproducible problems rather than introducing speculative caches or complexity.

## Conditional references and tools

Read only the sections relevant to the task:

- `PRODUCT.md`: product scope and visual direction.
- `src/features/base-designer/README.md`: editor architecture, state ownership, gestures, routes, artwork and profiling; also applies to its store and tests.
- `src/features/base-designer/docs/reglas/README.md`: maintained rule matrix for developers and AI agents. Locate the relevant rule IDs before changing behavior and update affected entries and source links with the implementation; approved pending rules are not implemented behavior.
- `src/shared/data/main-sequence/README.md`: source interpretation and catalog maintenance.
- `TESTS.md`: test contracts and browser-verification expectations.
- `README.md`: setup and user-facing workflows.

Use skills when their workflow adds value; do not load overlapping guides by default. Project decisions govern intended behavior; installed-version contracts and measured evidence govern technical validity. Resolve conflicts explicitly instead of applying generic advice mechanically.

Use Graphify for architecture, relationship or impact questions spanning modules when its graph is useful. Verify findings against current source; use direct search for straightforward local tasks. If work relies on the graph and changes represented source, refresh it at completion with `graphify update .` when available.

Use Impeccable for explicit design, UX critique or visual refinement when useful. Use debugging, test and performance references proportionally to the problem, checking compatibility with installed versions.

Optional local scripts and generated Graphify output are not checkout or CI requirements. Do not make ordinary work depend on their availability.
