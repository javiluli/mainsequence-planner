# Main Sequence Planner

Main Sequence Planner turns structured game recipes, machine data and research metadata into a clear production workflow. The Planner is the main workflow; the catalog and research views provide the source context around it.

## Current scope

- **Planner** — choose a target and production rate, inspect the calculated chain, and adjust supported planning inputs.
- **Items** — browse and filter the current catalog and open an item directly in the Planner.
- **Buildings & Recipes** — inspect machines and the recipes they expose.
- **Research** — explore the game-backed technology graph by science branch, search its nodes and inspect costs, prerequisites and unlocks.

## Development

Requirements: Node.js 24.20.0 and pnpm 11.19.0.

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

## Validation

Run the same checks used by the current CI job:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

There is no active Playwright E2E suite in the repository.

## Architecture

The application follows a feature-first structure:

```text
source JSON
   ↓
shared/data boundary
   ↓
feature/domain logic
   ↓
Zustand + providers
   ↓
page UI
```

The three JSON files in `src/shared/data/main-sequence/` are the single source of truth. They contain 70 items, 8 real crafting machines, 63 recipes and 97 technologies extracted from the game files. Raw resources are external planner inputs, not fictional producer buildings. Power values use the game's MW unit.

## Updating game data

The committed JSON is what Vite loads at runtime. The maintenance script can rebuild it from an FModel `MainSequence/Content` export:

```powershell
pnpm data:main-sequence "C:\path\to\FModel\Output\Exports\MainSequence\Content"
```

The script checks expected source counts, recipe references and missing icon files before replacing the generated catalog. See [the catalog notes](./src/shared/data/main-sequence/README.md) for the compact data contract.

Repository conventions live in [AGENTS.md](./AGENTS.md).
