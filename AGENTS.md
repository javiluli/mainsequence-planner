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

`scripts/build-main-sequence-catalog.mjs` is a maintenance tool for game updates, not a runtime dependency. Keep stable IDs because they are also used by exported icon mappings. Update presentation aliases instead of changing gameplay IDs to fit filenames.

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

## Visual direction

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
