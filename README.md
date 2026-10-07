# 🏭 Main Sequence Planner

Plan production chains and sketch your base for **Main Sequence**.

**[Open the planner →](https://mainsequence-planner.vercel.app/)**

## 🎮 For players

- **Planner** — choose an item and a production rate. Explore its chain as a graph or tree.
- **Buildings** — see how many machines you need, their individual costs and all construction materials combined.
- **Items & Recipes** — browse the catalog, production recipes and research requirements.
- **Research** — explore unlocks and their dependencies.
- **Bases** — arrange stations, machines, belts and drones; add notes and compare your layout with your plan.

### Get started

1. Open **Planner**, select your target item and enter the amount per minute.
2. Use **Tree list** or the graph to inspect the chain. Open **Buildings** for your construction shopping list.
3. Open **Bases** from the plan to compare required buildings and item rates with your layout.

In Bases, open **Build**, place a station and add machines or belts. Right-drag pans the canvas; **R** rotates previews, **F** toggles a machine output, and **Escape** cancels. Copy/paste and undo/redo use the usual **Ctrl+C/V/Z/Y** shortcuts.

**Your base saves automatically in this browser.** Reloading restores the layout and notes. Undo history and clipboard last only for the current session. Clearing browser site data removes the saved base; it does not sync between devices.

Item rates in Bases show nominal machine output, not actual belt delivery or ingredient availability.

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
- [Bases architecture](./src/features/base-designer/README.md)
- [Game catalog and data maintenance](./src/shared/data/main-sequence/README.md)
- [Test contracts](./TESTS.md)

The committed catalog is sufficient to run the app. Optional maintenance scripts are local tools and are not included in Git.
