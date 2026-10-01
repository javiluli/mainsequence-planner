# Main Sequence Planner

Main Sequence Planner turns structured game recipes, machine data and research metadata into a clear production workflow. The Planner is the main workflow; the catalog and research views provide the source context around it.

## Current scope

- **Planner** — choose a target and production rate, inspect the calculated chain, and adjust supported planning inputs. Its empty state uses the lazy-loaded item network background instead of the random-item marquee.
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

The Bases page is an early layout prototype. Open Build for stations, machines and logistics. Selecting a station starts a grid-snapped, cursor-centered preview, not an immediate insertion: click or Enter confirms, arrows reposition, and Escape/right-click cancels. The tool stays active for repeated placement; red previews reject overlaps without changing the layout or history. A 1×1 station has a 14×14-cell buildable footprint and a 2×2 has a 30×30-cell footprint; every cell, including those at the edge, is buildable. The decorative frame extends slightly beyond the floor grid, while floor tiles and machine bodies use a small visual inset; logical cell sizes and connections do not change. The first station has one six-cell opening per edge; the second has two. When matching doorways are aligned across a two-cell gap, that gap becomes a buildable 2×6 corridor for machines and belts. Drag a free part of a station to move it, or drag a machine to another free footprint. A machine may span the joined floor without becoming two parts, but neither machines nor belts can cross a closed wall or an unconnected gap. Stations use the grid but do not magnetically snap; only an aligned physical connection permits parts across modules. Stations linked by a part move together and cannot be separated or removed until the link is cleared. Copying one station keeps complete local routes but omits an entire route if any segment needs another module or its corridor; spanning machines are omitted too, with counts shown after pasting.

For belts, click a starting cell or machine port, add orthogonal anchors, and click the last anchor again to confirm. Each confirmed route is one editable shape, even across aligned stations: drag any segment to move the entire route, or erase any segment to remove it. Start a new segment at an existing route's output end, finish at its input end, or finish against the side of a straight belt to merge into it while keeping one route identity. Adjacent belts connect only in the directed path; crossing cells does not create a splitter. Mk1 and Mk2 belts are labeled 60 and 120 items/min respectively, but the layout does not simulate throughput. Longer belt marks animate only along complete directed paths from a machine or assigned drone output to another machine input; inactive rails remain empty. A splitter has one teal input and three amber outputs. Underground belts have a straight, buried span of up to six cells for Mk1 or eight for Mk2; their endpoints stay on the surface.

While drawing, an invalid preview explains whether the route hits a wall, leaves connected floor, overlaps a part, reverses direction, meets a different belt tier, or exceeds the underground length/shape rule. A rejected click keeps the previously accepted anchors so the last segment can be redrawn.

Hover a machine I/O in Select mode and press F to toggle outgoing permission, including without a belt: free enabled ports are gray without arrows and blocked ports show a cross. Outputs are enabled by default; correctly directed belts on valid I/O connect automatically, while inward belts remain inputs even when output is off. Click a free I/O with the empty hand to start Conveyor Belt Mk. 1 without opening Build; continuing a free belt output preserves its existing tier and route identity. Enter/Space on a hovered terminal offers the same shortcut. Open belt ends have neutral gray terminals with directional arrows and shared hover feedback. Each passage has synchronized lock controls on both sides, outside its buildable floor. This remains a layout interaction, not a calculation of item flow.

The Box has no product picker, including through the toolbar. Its eight unconnected I/O stay neutral gray without arrows; a connected belt determines input/output feedback and F still marks blocked output. Shared connectors are 15×9 px (9×15 on side faces); the Box uses compact 12×7 px connectors to keep adjacent corner ports separate. Neither visual size changes connection centers or footprints. Drone outlets and splitter ports keep their fixed directional markers.

The 14×14 drone module has two assignable outputs on one face and no buildable interior. R or Rotate turns its preview or selected module in quarter turns, including the outlets and connecting face. Rotation is rejected when a locked link or an occupied corridor would lose its floor; existing belts do not move with the outlets. Click either drone to select its cargo from the game catalog in a modal; each drone shows its assigned item icon. Use the small product button on a machine, or select it and press **Product** in the toolbar, to choose the item it represents. The picker lists each catalog-backed primary product once, independent of belts, input ingredients and rates. Existing recipe alternatives are preserved when choosing the same product; any confirmed co-products remain visual badges. Buildings without production records show an explicit empty state, not invented items. Clear assignment removes the label and Undo restores it. There is no separate input marker or automatic machine inspector.

**Buildings** is a compact count list on the left, collapsible above the canvas on small screens. It excludes belts and splitters. Opening Bases from Planner, Items or Buildings & Recipes uses `/bases?compare=planner` and adds required-versus-built counts from the existing plan; directly opening `/bases` shows built counts only and does not calculate a production plan. Unsupported building types and invalid references are explicit. The comparison is by machine type, not recipe coverage, material delivery or production rate. **Inventory**, its search/locate actions and its dock have been removed; there is no production/throughput report.

The Note button creates a free, movable annotation. Shift-drag selects parts and whole routes, not stations or notes; drag the group or use Shift+arrow keys to nudge it. Ctrl+C copies and Delete removes the selection. Ctrl+V previews copied parts under the cursor on the snapped grid; click or Enter confirms, arrows reposition, and Escape/right-click cancels. Invalid copies are rejected atomically. Stations and notes retain separate duplication behavior. Middle-click picks a placed part's tool. R rotates a selected part; Ctrl+Z and Ctrl+Y undo and redo session changes. Existing energy markers use known catalog values only; unknown consumption or reactor generation is never invented. Layouts and notes remain session-only.

Canvas selection uses amber inset borders. The container retains its neutral storage plate and eight I/O openings; splitters retain teal input and amber output arrows. A primary-product icon, capped at half the shorter machine side and 88 px, replaces the machine nameplate; confirmed co-products remain smaller badges with `+N` for excess products. Product artwork does not intercept pointer gestures or native image dragging. Clearing the product restores the nameplate. The drone deck shares the six-cell doorway width and open-ended rails, including rotated previews. Reduced-motion preference stops canvas belt/image motion; inactive rails remain empty. Tools, editing/energy markers and status stay outside the unobstructed canvas. Cursor placement preserves pan/zoom, including the first station; **Fit layout** explicitly frames the base. New notes are centered in the available canvas. Buttons, dialogs, selectors and note inputs use HeroUI with Tailwind; measured canvas artwork remains feature-owned SVG/CSS.

For maintenance, `model/station-node.ts` owns the station-node and preview contracts. `ui/use-station-interactions.ts` owns transient pointer/keyboard gestures and their occupied-cell view, including station placement; `lib/station-spatial.ts` accepts numeric screen bounds for cell/port hit-testing and projects cells between station-local spaces. `ui/station-artwork.tsx` shares frame/drone drawing between committed nodes and cursor previews. Artwork and hit-testing share the same port positions and optical inset. `ui/station-node.tsx` composes those modules with the existing floor, part and preview drawing; layout validation and mutations remain in the domain modules and store.

World placements, corridors, neighboring pieces and the draft route are derived in the parent and shared with the station nodes. Hover changes do not rebuild the neighboring-piece arrays. Placed machine/belt artwork is memoized with stable wall-access callbacks; the bounded desktop preview measurement and its limitations are recorded in the audit, not a general large-layout performance guarantee. The store retains up to 50 immutable session snapshots, not a persisted history or a second catalog.

Escape/right-click cancels previews and captured part drags. Changing editing context or undo/redo discards an old gesture; losing window focus also returns to Select and rolls back a live station/note movement. A second pointer cannot replace the pointer that owns a part drag. A rejected move or a module/note returned to its starting position does not add an undo step. Dialogs keep their own keyboard handling.

Current audit progress and the remaining manual acceptance/performance work are tracked in [docs/base-designer-audit.md](./docs/base-designer-audit.md). [AUDIT_BASES.md](./AUDIT_BASES.md) is historical evidence for the earlier prototype, not verification of the current feature.

Station modules use the same 20-pixel build grid as their floor cells, without magnetic docking. Exact doorway alignment is required for the modules to connect.

Disabling a machine I/O output with F does not block its input. The disabled output follows that physical port when the machine rotates with R.

Belt routes can start directly from a machine opening and finish with one click on a destination opening; the placed belt occupies the adjacent free cells, not the machine footprint. Moving slats run only on complete directed machine-to-machine routes.

Route rotation is disabled so its turns cannot be broken independently. Routes crossing multiple stations remain one editable belt.

On assigned machines the add-product button is hidden. In Select mode, right-click a machine to clear its product and restore its nameplate and button; Undo restores the assignment. Right-click during drawing, pasting or a part drag only cancels that gesture. The toolbar Product action remains available for keyboard/touch editing and clearing.

Station placement previews also show every proposed corridor using the same exact alignment rules as committed modules. These passages are translucent and disappear on cancellation; invalid placement shows no proposed floor. Corridor lock buttons sit outside the buildable passage, with a compact visual size and a larger click target. Drone modules retain their 14×14 reserved footprint and outlet positions but have no rectangular background/frame; their rounded hull provides the visual outline and selection accent.

Drone connections are the exception to the standard two-cell station gap: a drone module connects across exactly one empty cell, creating a 1×6 passage (or 6×1 when vertical). Preview, buildable floor, belt validation and locks use that same rule in every orientation; the six-cell doorway and drone footprint are unchanged.

## Updating game data

The committed JSON is what Vite loads at runtime. The maintenance script can rebuild it from an FModel `MainSequence/Content` export:

```powershell
pnpm data:main-sequence "C:\path\to\FModel\Output\Exports\MainSequence\Content"
```

The script checks expected source counts, recipe references and missing icon files before replacing the generated catalog. See [the catalog notes](./src/shared/data/main-sequence/README.md) for the compact data contract.

Repository conventions live in [AGENTS.md](./AGENTS.md).
