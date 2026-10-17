# Game icon assets

The `items/` and `buildings/` folders contain game artwork used by `AssetImage`. The generated `research/` folder contains technology artwork addressed by the source icon ID stored in `research.json`. A game's logical item or machine ID is not necessarily the same as its texture filename, so presentation-only aliases may exist in `src/shared/ui/asset-image/icon-source.ts`.

The current files are exported Main Sequence textures. A missing or failed image uses the neutral `AssetImage` fallback rather than borrowing unrelated artwork.

Do not rename or modify game-data JSON to work around an image path. Update presentation mappings when a verified asset correspondence is available. When research art is missing, export the actual PNG or WebP texture from FModel and rerun the catalog generator; texture metadata JSON alone is insufficient.
