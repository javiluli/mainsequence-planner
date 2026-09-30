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

The Bases page is an early layout prototype. Open Build for stations, machines and logistics, then click the floor to place copies. A 1×1 station has a 14×14-cell buildable footprint and a 2×2 has a 30×30-cell footprint; every cell, including those at the edge, is buildable. The decorative frame extends slightly beyond the floor grid, while floor tiles and machine bodies use a small visual inset; logical cell sizes and connections do not change. The first station has one six-cell opening per edge; the second has two. When matching doorways are aligned across a two-cell gap, that gap becomes a buildable 2×6 corridor for machines and belts. Drag a free part of a station to move it, or drag a machine to another free footprint. A machine may span the joined floor without becoming two parts, but neither machines nor belts can cross a closed wall or an unconnected gap. Stations use the grid but do not magnetically snap; only an aligned physical connection permits parts across modules. Stations linked by a part move together and cannot be separated or removed until the link is cleared. Copying one station keeps complete local routes but omits an entire route if any segment needs another module or its corridor; spanning machines are omitted too, with counts shown after pasting.

For belts, click a starting cell or machine port, add orthogonal anchors, and click the last anchor again to confirm. Each confirmed route is one editable shape, even across aligned stations: drag any segment to move the entire route, or erase any segment to remove it. Start a new segment at an existing route's output end, finish at its input end, or finish against the side of a straight belt to merge into it while keeping one route identity. Adjacent belts connect only in the directed path; crossing cells does not create a splitter. Mk1 and Mk2 belts are labeled 60 and 120 items/min respectively, but the layout does not simulate throughput. Longer belt marks animate only along complete directed paths from a machine or assigned drone output to another machine input; inactive rails remain empty. A splitter has one teal input and three amber outputs. Underground belts have a straight, buried span of up to six cells for Mk1 or eight for Mk2; their endpoints stay on the surface.

While drawing, an invalid preview explains whether the route hits a wall, leaves connected floor, overlaps a part, reverses direction, meets a different belt tier, or exceeds the underground length/shape rule. A rejected click keeps the previously accepted anchors so the last segment can be redrawn.

Select a machine and expand **I/O ports** in its inspector to see each opening by face and cell. The panel distinguishes input, output, blocked output, no belt and no floor access. Each `Output on/off` button changes only outgoing permission; an incoming belt remains connected even when output is off. Buttons and the canvas F shortcut share the same action and session undo history. Ports are derived from world-space connections, including aligned station joins; they do not simulate item flow. Inspector content scrolls independently of its status messages.

The 14×14 drone module has two assignable outputs on one face and no buildable interior. Click either drone to select its cargo from the game catalog in a modal; each drone shows its assigned item icon. Select a machine to assign a recipe from the game catalog; its inputs and outputs are shown for layout reference, not production simulation. For a machine with a recipe, an optional item marker can be chosen only from that recipe's inputs and appears on the machine. Changing recipes clears an incompatible marker. Hover a machine I/O and press F to toggle its output behavior. The Note button creates a free, movable annotation. Shift-drag across the floor selects parts and whole routes, not stations or notes; drag any selected part to move the group, or use Shift+arrow keys to nudge it. Ctrl+C copies the selection and Delete removes it. Ctrl+V or Paste previews copied parts centered under the cursor on the snapped grid; click or press Enter to confirm, use arrows for keyboard positioning, or Escape/right-click to cancel. Invalid copies are rejected as a whole without relocating them elsewhere. Stations and notes retain their separate duplication behavior. Middle-click a placed part to pick its tool. Right-click or Escape cancels the current tool or route. Select an element to rotate it with R or remove it with Delete; Ctrl+Z and Ctrl+Y undo and redo session changes. The flow displays machine count and confirmed energy values; incomplete energy totals use a lower bound or dash rather than a fabricated value. Items and Buildings & Recipes can set an item target and open Bases; the Planner toolbar keeps its current target. Bases compares global placed-machine inventory by type with Planner's required count, not recipe-by-recipe coverage. Unavailable machine types, targets with no machine steps, and invalid plans have explicit messages. Mk1/Mk2 figures are nominal capacity per belt, not calculated item flow or belt load. Layouts and notes live only in memory for this page session.

Open **Inventory** for a searchable list of placed machines and logistics, with each complete route listed once across its stations. Entries show owner/stations, direction and assigned recipe where applicable. Arrow keys, Home and End move focus; Enter or Space selects the entry and synchronizes the canvas selection without changing the viewport. **Locate** frames the part or whole route and focuses its station grid; **Settings** focuses the machine inspector. Copy, Rotate (parts only) and Delete use the existing editing actions. Closing the panel returns focus to its toolbar button; deleting from the inventory advances to a remaining entry or the search field. The panel docks beside the canvas on desktop and below it on small screens.

Canvas selection uses amber inset borders for machines and splitters, and amber rails for complete belt routes. The container has a neutral storage plate and box symbol, with its existing eight I/O openings. Splitter arrows point inward at the teal input and outward at the three amber outputs; connected ports are brighter, and Inventory names all four faces. A disconnected machine port still shows when output is disabled. An incoming arrow remains teal, with a small red mark when only its output permission is off. Recipe product badges stay above the nameplate and the optional input marker below; compact machines use smaller badges. Excess products are summarized with `+N` on the machine and remain fully listed in the inspector. Reduced-motion preference stops belt animation and asset transitions/shimmers within the plan and inspector; inactive rails remain empty.

Bases uses a compact page heading and separate tool, editing/metrics and status bars, leaving the grid unobstructed. Inspector and Inventory share one dock beside the canvas on desktop or below it on small screens. Use **Inspector** to close/reopen the selected machine's settings; **Settings** in Inventory switches to that inspector. **Planner reference** opens a bounded, scrollable popover from the toolbar. The first station is framed once automatically; later additions, removals, window resizing and panel changes preserve pan/zoom. Use **Fit layout** for the complete layout or **Locate** for one part/route. New notes are centered in the available canvas. The status bar also reminds users that reloading clears this session-only design.

For maintenance, `model/station-node.ts` owns the station-node and preview contracts. `ui/use-station-interactions.ts` owns transient pointer/keyboard gestures and their occupied-cell view; `lib/station-spatial.ts` accepts numeric screen bounds for cell/port hit-testing and projects cells between station-local spaces. Artwork and hit-testing share the same port positions and optical inset. `ui/station-node.tsx` composes those modules with the existing floor, part and preview drawing; layout validation and mutations remain in the domain modules and store.

World placements, corridors, neighboring pieces and the draft route are derived in the parent and shared with the station nodes. Hover changes do not rebuild the neighboring-piece arrays; this removes duplicate calculations but is not a measured large-layout performance guarantee. The store retains up to 50 immutable session snapshots, not a persisted history or a second catalog.

Escape/right-click cancels previews and captured part drags. Changing editing context or undo/redo discards an old gesture; losing window focus also returns to Select and rolls back a live station/note movement. A second pointer cannot replace the pointer that owns a part drag. A rejected move or a module/note returned to its starting position does not add an undo step. Escape from the inspector closes it and returns focus to its toolbar button; dialogs keep their own keyboard handling.

Current audit progress and the remaining manual acceptance/performance work are tracked in [docs/base-designer-audit.md](./docs/base-designer-audit.md). [AUDIT_BASES.md](./AUDIT_BASES.md) is historical evidence for the earlier prototype, not verification of the current feature.

Station modules use the same 20-pixel build grid as their floor cells, without magnetic docking. Exact doorway alignment is required for the modules to connect.

Disabling a machine I/O output with F does not block its input. The disabled output follows that physical port when the machine rotates with R.

After assigning a recipe, the machine shows its catalog product above its nameplate; any co-products appear beside it. The optional input marker stays below the nameplate. The recipe panel names each output, and changing or clearing the recipe updates these markers without assigning items to belts or simulating production.

Belt routes can start directly from a machine opening and finish with one click on a destination opening; the placed belt occupies the adjacent free cells, not the machine footprint. Moving slats run only on complete directed machine-to-machine routes.

Route rotation is disabled so its turns cannot be broken independently. Routes crossing multiple stations remain one editable belt.

## Updating game data

The committed JSON is what Vite loads at runtime. The maintenance script can rebuild it from an FModel `MainSequence/Content` export:

```powershell
pnpm data:main-sequence "C:\path\to\FModel\Output\Exports\MainSequence\Content"
```

The script checks expected source counts, recipe references and missing icon files before replacing the generated catalog. See [the catalog notes](./src/shared/data/main-sequence/README.md) for the compact data contract.

Repository conventions live in [AGENTS.md](./AGENTS.md).
