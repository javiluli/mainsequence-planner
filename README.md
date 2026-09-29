# Main Sequence Planner

Main Sequence Planner turns structured game recipes, machine data and research metadata into a clear production workflow. The Planner is the main workflow; the catalog and research views provide the source context around it.

## Current scope

- **Planner** — choose a target and production rate, inspect the calculated chain, and adjust supported planning inputs.
- **Items** — browse and filter the current catalog and open an item directly in the Planner.
- **Buildings & Recipes** — inspect machines and the recipes they expose.
- **Research** — explore the game-backed technology graph by science branch, search its nodes and inspect costs, prerequisites and unlocks.
- **Bases** — sketch station modules on an open canvas, place measured machine footprints and plan directed belt routes with anchors and live previews.

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

The three JSON files in `src/shared/data/main-sequence/` are the single source of truth. They contain 70 items, 8 real crafting machines, 63 recipes and 97 technologies extracted from the game files. Raw resources are external planner inputs, not fictional producer buildings. Energy-use values display in the game's MJ unit.

Items with no standalone recipe are also shown as external-input leaves, so known chains remain navigable instead of switching to a separate partial graph. They do not imply a fictional machine. Continuous Supply is added or edited from eligible graph nodes; the node editor starts at the node's full required rate and uses one decimal place. The toolbar provides a quick list of configured deliveries with removal controls. Supply is a delivery rate in items/min, not stored inventory. The product pages share an edge-to-edge shell with padded content and subtle separators.

The Bases page is an early layout prototype. Open Build for stations, machines and logistics, then click the floor to place copies. A 1×1 station has a 14×14-cell buildable footprint and a 2×2 has a 30×30-cell footprint; every cell, including those at the edge, is buildable. The decorative frame extends slightly beyond the floor grid, while floor tiles and machine bodies use a small visual inset; logical cell sizes and connections do not change. The first station has one six-cell opening per edge; the second has two. When matching doorways are aligned across a two-cell gap, that gap becomes a buildable 2×6 corridor for machines and belts. Drag a free part of a station to move it, or drag a machine to another free footprint. A machine may span the joined floor without becoming two parts, but neither machines nor belts can cross a closed wall or an unconnected gap. Stations use the grid but do not magnetically snap; only an aligned physical connection permits parts across modules. Stations linked by a part move together and cannot be separated or removed until the link is cleared. Copying one station omits shared pieces rather than leaving them stranded outside the copy.

For belts, click a starting cell or machine port, add orthogonal anchors, and click the last anchor again to confirm. Each confirmed route is one editable shape, even across aligned stations: drag any segment to move the entire route, or erase any segment to remove it. Start a new segment at an existing route's output end (or finish at its input end) to extend it while keeping one route identity. Adjacent belts connect only head-to-tail, and the longer belt marks animate only along complete directed paths from a machine output to another machine input; inactive rails remain empty. A splitter has one teal input and three amber outputs. Middle-click a placed part to pick its tool. Right-click or Escape cancels the current tool or route. Select an element to rotate it with R, remove it with Delete, or copy and paste with Ctrl+C/Ctrl+V; Ctrl+Z and Ctrl+Y undo and redo session changes. The flow displays machine count and confirmed energy values; incomplete energy totals use a lower bound or dash rather than a fabricated value. Layouts live only in memory for this page session, and belts remain visual routes rather than simulated throughput.

Station modules use the same 20-pixel build grid as their floor cells, without magnetic docking. Exact doorway alignment is required for the modules to connect.

Belt routes can start directly from a machine opening and finish with one click on a destination opening; the placed belt occupies the adjacent free cells, not the machine footprint. Moving slats run only on complete directed machine-to-machine routes.

Route rotation is disabled so its turns cannot be broken independently. Routes crossing multiple stations remain one editable belt.

## Updating game data

The committed JSON is what Vite loads at runtime. The maintenance script can rebuild it from an FModel `MainSequence/Content` export:

```powershell
pnpm data:main-sequence "C:\path\to\FModel\Output\Exports\MainSequence\Content"
```

The script checks expected source counts, recipe references and missing icon files before replacing the generated catalog. See [the catalog notes](./src/shared/data/main-sequence/README.md) for the compact data contract.

Repository conventions live in [AGENTS.md](./AGENTS.md).
