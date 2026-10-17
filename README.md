# 🏭 Main Sequence Planner

Plan production chains and sketch your base for **Main Sequence**.

**[Open the planner →](https://mainsequence-planner.vercel.app/)**

## 🎮 For players

- **Planner** — choose an item and a production rate. Explore its chain as a graph or tree.
- **Buildings** — see how many machines you need, their individual costs and all construction materials combined.
- **Items & Recipes** — browse the catalog, production recipes and research requirements.
- **Research** — explore unlocks and their dependencies. Search and press Enter, or select a technology with Enter/Space, to open readable detail. Fit shows its full tree; Back to overview or Escape in the canvas returns to the catalog overview.
- **Bases** — arrange stations, catalog machines and drone cargos; assign recipes, connect belts, splitters and tunnels and edit explicit selections.

### Get started

1. Open **Planner**, select your target item and enter the amount per minute.
2. Use **Tree list** or the graph to inspect the chain. Open **Buildings** for your construction shopping list.
3. Open **Bases** to sketch station positions, or use Planner's Bases shortcut to compare your placed machines with the current plan. **Edit in Planner** returns to the same target, rate, recipes and supplies.

Selecting a production item presets one machine's net output using its saved recipe or the neutral route. In **Recipes**, **Plan this recipe** opens the exact card's route at that rate, preserving other recipe choices and supplies. You can then edit the rate; supply may reduce the machines actually required. Raw targets remain external by default, with a 1/min preset unless a valid synthesis recipe is already selected. In **Recipe selection**, raw targets and ingredients with a catalog synthesis offer **External input** or the real production route; switching routes keeps the target rate and supplies. Their **Plan this recipe** catalog shortcut starts at that recipe's net one-machine output.

In the graph, double-click a node or press **Enter/Space** on it to toggle its direct connections; **Escape** clears the highlight. Arrow keys move a highlighted node when interaction is unlocked. Diagram tabs stay available while a view loads. ThinkingOrb fades out before the result fades in; prepared views use a short fade. With reduced motion enabled, ready content opens without the presentation delay.

Tree list labels external inputs, continuous supply and coproduct origins from the same plan as the graph. Its machine counts describe individual branches; Buildings and the toolbar report physical requirements for the whole plan.

In Bases, search an element by name or category in the catalog, or choose one of the six recent entries, then click to place repeatedly until **Escape**. Buildings must fit in one station. Moving or removing occupied floors requires explicitly selecting every piece that would lose support. **R** rotates the selection. Belt destinations create valid orthogonal elbows automatically; click the last anchor again to finish. Right-click removes the latest destination; right-drag pans. The wheel zooms under the cursor. Gray free belt ends indicate where to reconnect or continue.

Double-click the body of a Refinery, Assembler or Enrichment Chamber to choose its product and recipe. Search products, review ingredient amounts and select a variant to assign it immediately; **Clear recipe** removes the assignment. The product icon remains visible on the machine. Recipe editing has no extra toolbar button.

Hover an I/O to see its known products and Enabled/Disabled status. **F** toggles its output while retaining machine input. **C** centers the whole scene at 100%. Inactive belts show an empty track. Disabled ports use the theme danger color. Output control panels remain removed. Known products and nominal recipe amounts do not guarantee supply or transport capacity.

Open **Production** from the left menu for whole-base estimated output, its nominal capacity, ingredient supply and known nominal machine energy. Each ingredient separates **Supplied**, **Needed** and **Missing**; the recipe requirement is not the drone delivery rate. A machine's LED shows sufficient inputs (green), an incompatible item (red), a missing ingredient (amber), insufficient quantity (violet), or an indeterminate/unassigned recipe (gray). Hover over its body for individual input allocations and requirements. Only machines with insufficient quantity get a red body tint; belts and other network elements keep their normal colors. Splitters share equally and redistribute blocked/saturated exits; receivers within a lane take priority by route proximity, then placement order. These are nominal estimates, not simulated production percentages. Station naming has been removed; existing saved labels remain compatible metadata.

MK1 transport carries **60/min** and MK2 **120/min**. Drone cargos are limited by their connected transport; they have no separate rate setting. For example, four machines demanding 20/min behind one MK1 feed show 80/min demand, up to 60/min coverable and at least 20/min missing. Known acyclic networks can pool sources of the same ingredient within transport limits. Loops, mixed products and dependencies on unsupplied machines remain undetermined; accepted shares are not globally rearranged to maximize production.

Use **Ctrl+Z** to undo and **Ctrl+Shift+Z** to redo confirmed edits (Cmd on macOS), or the floating canvas buttons. History retains up to 100 operations during the session. Restoring a step cancels active gestures and clears selection while keeping the clipboard; reloading keeps the scene but clears history.

**Bases automatically saves one confirmed scene locally in this browser and restores it on reload.** Selection, clipboard, camera and previews are not saved. Storage errors show an alert; keep the page open and retry if saving fails. Use one editing tab at a time. Previous saved bases remain untouched, separately from the new scene. The original editor, documentation and tests are preserved in Git at `34de597` on `master`; see the [feature documentation](./src/features/base-designer/README.md).

Drag a rectangle from free floor to select by contact; hold **Shift** to exclude stations and drones. **Ctrl/Cmd+click** adds/removes individual targets. Copy, cut, paste, delete, move and rotate operate on the explicit selection atomically. Pasting stays active until Escape. Moving or removing buildings leaves belts in place; animation indicates a geometric output-to-input path, not actual production. Three-arm merges on straight cells or corners are allowed; X crossings are blocked.

### 💬 Feedback

Found a problem or have an idea? **[Open an issue](https://github.com/javiluli/mainsequence-planner/issues/new/choose)** with a short description and, for bugs, steps to reproduce it.

## 🛠️ For developers

Use **Node.js 24.20.0** and **pnpm 11.19.0**.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Before submitting changes:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

Built with React, TypeScript, Vite, React Flow, Zustand, HeroUI and Tailwind CSS.

- [Repository conventions](./AGENTS.md)
- [Product scope and visual direction](./PRODUCT.md)
- [Bases architecture](./src/features/base-designer/README.md)
- [Pending Bases capabilities and decisions](./src/features/base-designer/docs/ideas-pendientes.md)
- [Game catalog and data maintenance](./src/shared/data/main-sequence/README.md)
- [Test contracts](./TESTS.md)

The committed catalog is sufficient to run the app. Optional maintenance scripts are local tools and are not included in Git.

For Bases browser workflows, also run `pnpm test:e2e`; [TESTS.md](./TESTS.md) covers Chromium setup and test boundaries. Large-selection performance and canvas accessibility limits remain documented in the Bases references.

A previous browser check observed the Items Select closing during a mouse click with reduced motion; keyboard opening worked. Its cause remains unverified and the proposed final V4 fix was discarded. General F21 workflow changes and optional React Flow attribution were also discarded; do not reintroduce them as pending work. The existing eager catalog boundary was retained after measurement, without a new code-splitting requirement.
