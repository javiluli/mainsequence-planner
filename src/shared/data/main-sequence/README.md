# Main Sequence planner catalog

These generated files deliberately expose only the data needed by the planner:

- `items.json`: item ID, display name and planner type;
- `buildings_and_recipes.json`: the eight source crafters, their MJ energy use and per-minute recipes;
- `research.json`: science branches, items that contribute points, technology costs, prerequisites, rewards and source icon IDs.

Item IDs retain the existing project convention because they resolve directly to the curated icon filenames. The few items that share artwork keep their existing presentation aliases.

Main Sequence research is a dependency graph rather than a set of linear levels. Technologies that require several sciences therefore appear in every applicable branch with that branch's point cost. Technologies without a science cost appear under `General`.

Raw resources are external/infinite planner inputs. They are not represented by fabricated machines. Source-backed ore synthesis remains listed as a real recipe on the Enrichment Chamber, but an unselected raw dependency terminates at the warehouse/resource node.

Regenerate the files by passing the FModel `MainSequence/Content` export directory:

```powershell
pnpm data:main-sequence "C:\path\to\FModel\Output\Exports\MainSequence\Content"
```

The generator reads Items, Recipes, Research, ResearchTypes, Crafters and Buildables directly from the FModel export. It checks the source counts before writing anything, preserves the stable planner/icon aliases and copies exported technology textures into `public/assets/icons/research`. Its summary reports any source textures that are still unavailable.

The in-game Códice is a useful cross-check, not a separate catalog: its item and recipe pages use `DAT_ItemRegistry` and `DAT_RecipeRegistry`. The current planner catalog covers 70 actual items and 63 recipes, all represented here. The Códice also lists non-production buildables. Its Workstation manually uses the existing Assembler and Refinery crafters, while the Teleporter and research labs do not add item recipes; none is a ninth automated production crafter.

For recipe relationships, trust each `Data/Recipes/REC_*.json` record's `Output`, `Inputs`, `ExtraOutputs` and `Crafter` fields, cross-checked against `DAT_RecipeRegistry`. Do not use `Data/Items/ITEM_*.json`'s optional `Recipe` pointer as a foreign key: this export has three pointers to recipes for different items, and many produced items have no pointer. The Códice item widget references `DAT_RecipeRegistry` and a `FindRecipes` operation. Its item registry also contains the `ITEM_AnyItemFilter` UI placeholder (“No Item”); `ITEM_Thruster` is not registered in the Códice. Neither belongs in the planner catalog.

Biomass is a Growth Chamber coproduct, not an independent recipe output. The three two-second recycling recipes consume Biomass and a seed organism to produce more of that organism. Until a continuous source of the seed and Biomass is known, the planner shows the verified recipe but cannot calculate a complete, self-sustaining chain without user-supplied input rates.

This generator is a maintenance tool, not a runtime dependency. Vite does not execute or bundle it: the application consumes the committed JSON files. Its purpose is to make future game updates repeatable instead of manually editing dozens of recipes, ratios and research references.

FModel's **Save Properties** action produces texture metadata JSON. Actual planner icons require FModel's **Export Textures** action, which should produce PNG or WebP files.
