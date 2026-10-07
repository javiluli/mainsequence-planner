# Item Network Background

Decorative item network for Planner's empty state. It uses real catalog icons, but represents no recipe or production simulation. Navigation and central instructions must remain more prominent than the artwork.

## Structure

```text
src/features/planner/ui/item-network-background/
├── index.ts
├── item-network-background.tsx
├── network.config.ts
├── network.types.ts
├── hooks/
│   ├── use-network-canvas.ts
│   └── use-network-interaction.ts
├── runtime/
│   ├── network-runtime.ts
│   ├── observe-surface.ts
│   └── item-image-cache.ts
├── simulation/
│   ├── network-engine.ts
│   ├── node-population.ts
│   ├── node-motion.ts
│   └── network-topology.ts
├── animation/
│   ├── network-animation.ts
│   └── impact-envelope.ts
├── rendering/
│   ├── network-renderer.ts
│   ├── render.types.ts
│   ├── links.ts
│   ├── nodes.ts
│   ├── signal.ts
│   ├── impacts.ts
│   └── arc-cache.ts
└── lib/
    ├── math.ts
    └── palette.ts
```

## Ownership and invariants

- `network.config.ts` owns tunable motion, density and rendering parameters.
- Hooks connect the canvas and pointer lifecycle. Runtime owns resize, image loading and cleanup.
- Simulation owns node populations, roaming and proximity topology; animation owns signal/impact timelines; rendering draws their current state.
- Positions, links and signals share canvas coordinates. Resizing must update the viewport and backing buffer together.
- Nodes drift slowly with space between them; links evolve locally without collapsing the network toward the center.
- Signals reach their destination and impacts continue without abrupt resets. Cache catalog images instead of loading per frame.
- Use HeroUI theme colors with subdued alpha. Pause unnecessary work when hidden and respect reduced motion.

Keep algorithms independent of React. Avoid rebuilding listeners and observers on every frame; dispose them on unmount. Validate first render, resize, pointer interaction and cleanup when changing this component.
