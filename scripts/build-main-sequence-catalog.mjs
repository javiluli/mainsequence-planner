import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outputRoot = join(projectRoot, 'src', 'shared', 'data', 'main-sequence')
const publicIconRoot = join(projectRoot, 'public', 'assets', 'icons')
const publicResearchIconRoot = join(publicIconRoot, 'research')
const sourceRoot = resolve(process.argv[2] ?? process.env.MAIN_SEQUENCE_EXPORT_ROOT ?? '')

if (!process.argv[2] && !process.env.MAIN_SEQUENCE_EXPORT_ROOT) {
  throw new Error('Pass the FModel MainSequence/Content export directory or set MAIN_SEQUENCE_EXPORT_ROOT')
}

const loadJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const readJsonFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? readJsonFiles(join(directory, entry.name)) : entry.name.endsWith('.json') ? [join(directory, entry.name)] : [],
    )
    .sort((left, right) => left.localeCompare(right))

const readSourceRecord = (path, expectedType) => {
  const exports = loadJson(path)
  if (!Array.isArray(exports)) throw new Error(`${path} is not an export array`)

  const matching = exports.filter((record) => record.Type === expectedType)
  if (matching.length !== 1) throw new Error(`${path} contains ${matching.length} ${expectedType} exports`)
  return matching[0]
}

const readSourceRecords = (directory, expectedType) =>
  readJsonFiles(join(sourceRoot, 'Data', directory)).map((path) => readSourceRecord(path, expectedType))

const readMatchingSourceRecords = (directory, expectedType) =>
  readJsonFiles(join(sourceRoot, 'Data', directory)).flatMap((path) => {
    const exports = loadJson(path)
    if (!Array.isArray(exports)) throw new Error(`${path} is not an export array`)

    const matching = exports.filter((record) => record.Type === expectedType)
    if (matching.length > 1) throw new Error(`${path} contains ${matching.length} ${expectedType} exports`)
    return matching
  })

const referenceId = (reference) => {
  if (!reference) return null

  const match = /'([^']+)'$/.exec(reference.ObjectName)
  if (!match) throw new Error(`Unsupported Unreal reference: ${JSON.stringify(reference)}`)
  return match[1]
}

const displayName = (record) => record.Properties.DisplayName?.SourceString ?? record.Properties.DisplayName?.LocalizedString

const words = (value) =>
  value
    .replace(/^(DAT|BPO|REC)_/, '')
    .replace(/_C$/, '')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .trim()

const titleCase = (value) => words(value).replace(/\b\w/g, (letter) => letter.toUpperCase())
const snakeCase = (value) => words(value).replaceAll(' ', '_').toLowerCase()

const sourceItems = readSourceRecords('Items', 'Item')
const sourceRecipes = readSourceRecords('Recipes', 'Recipe')
const sourceResearch = readSourceRecords('Research', 'ResearchTechnology')
const sourceResearchTypes = readSourceRecords('ResearchTypes', 'ResearchType')
const sourceCrafters = readSourceRecords('Crafters', 'Crafter')
const sourceBuildables = readMatchingSourceRecords('Buildables', 'Buildable')

if (
  sourceItems.length !== 72 ||
  sourceRecipes.length !== 63 ||
  sourceResearch.length !== 97 ||
  sourceResearchTypes.length !== 7 ||
  sourceCrafters.length !== 8 ||
  sourceBuildables.length !== 58
) {
  throw new Error('The FModel source counts changed; inspect the new game build before replacing the generated catalog')
}

const itemIdOverrides = {
  ITEM_BackpackMk2: 'backpack_mk2',
  ITEM_BackpackMk3: 'backpack_mk3',
  ITEM_ContainmentCoil: 'T_ContainmentCoil',
  ITEM_ExoskeletonMk2: 'exoskeleton_mk2',
  ITEM_ExoskeletonMk3: 'exoskeleton_mk3',
  ITEM_RepairKitElectric: 'repair_kit_electric',
  ITEM_RepairKitHull: 'repair_kit_hull',
}

const excludedItemAssets = new Set(['ITEM_AnyItemFilter', 'ITEM_Thruster'])
const rawItemIds = new Set([
  'T_CobaltOre',
  'T_Graphite',
  'T_IridiumOre',
  'T_Lonsdaleite',
  'T_NickelOre',
  'T_NitrogenGas',
  'T_Silica',
  'T_TitaniumOre',
  'T_WaterIce1',
])
const processedItemIds = new Set([
  'T_ChromaticAlloy',
  'T_CobaltPlates',
  'T_Coolant',
  'T_DeuteriumFuel1',
  'T_EnrichedCobalt',
  'T_EnrichedNickel',
  'T_EnrichedTitanium',
  'T_Graphene',
  'T_HydrogenFuel',
  'T_IridiumPlates2',
  'T_NickelPlates1',
  'T_ReinforcedGlass1',
  'T_SiliconWafer2',
  'T_Superalloy',
  'T_TitaniumPlates1',
  'T_WarpFuel1',
])

const itemId = (record) => itemIdOverrides[record.Name] ?? referenceId(record.Properties.Icon)
const itemType = (id) => (rawItemIds.has(id) ? 'raw' : processedItemIds.has(id) ? 'processed' : 'component')
const catalogItemRecords = sourceItems.filter((record) => !excludedItemAssets.has(record.Name))
const itemRecordByAsset = new Map(catalogItemRecords.map((record) => [record.Name, record]))
const itemIdByAsset = new Map(catalogItemRecords.map((record) => [record.Name, itemId(record)]))

const items = catalogItemRecords.map((record) => {
  const id = itemId(record)
  const name = displayName(record)
  if (!id || !name) throw new Error(`${record.Name} does not have a planner ID and display name`)
  return { id, name, type: itemType(id) }
})

const itemIds = new Set(items.map((item) => item.id))
if (itemIds.size !== items.length) throw new Error('Generated item IDs are not unique')

const itemIdFromReference = (reference) => {
  const asset = referenceId(reference)
  const id = itemIdByAsset.get(asset)
  if (!id) throw new Error(`Missing planner item for ${asset}`)
  return id
}

const recipeIdAliases = {
  magetic_coils: 'magnetic_coils',
}
const recipeId = (record) => {
  const id = snakeCase(record.Name)
  return recipeIdAliases[id] ?? id
}
const recipeIdByAsset = new Map(sourceRecipes.map((record) => [record.Name, recipeId(record)]))

const ratePerMinute = (amount, craftingTime) => {
  if (!(craftingTime > 0)) throw new Error(`Invalid crafting time: ${craftingTime}`)
  return Number(((amount * 30 * 60) / craftingTime).toFixed(6))
}

const mapRecipeAmount = (amount, craftingTime) => ({
  id: itemIdFromReference(amount.Item),
  amount_per_minute: ratePerMinute(amount.Amount, craftingTime),
})

const recipesByCrafter = new Map()
for (const record of sourceRecipes) {
  const { CraftingTime: craftingTime, ExtraOutputs: extraOutputs = [], Inputs: inputs = [], Output: output } = record.Properties
  const recipe = {
    id: recipeId(record),
    output: mapRecipeAmount(output, craftingTime),
    inputs: inputs.map((amount) => mapRecipeAmount(amount, craftingTime)),
    ...(extraOutputs.length ? { extra_outputs: extraOutputs.map((amount) => mapRecipeAmount(amount, craftingTime)) } : {}),
  }
  const crafterAsset = referenceId(record.Properties.Crafter)
  const recipes = recipesByCrafter.get(crafterAsset) ?? []
  recipes.push(recipe)
  recipesByCrafter.set(crafterAsset, recipes)
}

const crafterConfiguration = [
  { asset: 'CRAFT_Refinery', buildable: 'DAT_Refinery', id: 'refinery' },
  { asset: 'CRAFT_Assembler', buildable: 'DAT_Assembler', id: 'fabricator' },
  { asset: 'CRAFT_Enrichment', buildable: 'DAT_EnrichmentChamber', id: 'enrichment' },
  { asset: 'CRAFT_GrowthChamber', buildable: 'DAT_GrowthChamber', id: 'growth_chamber' },
  { asset: 'CRAFT_AdvancedAssembler', buildable: 'DAT_AdvancedAssembler', id: 'advanced_assembler' },
  { asset: 'CRAFT_Armoury', buildable: 'DAT_Armoury', id: 'armoury' },
  { asset: 'CRAFT_RelicSynthesizer', buildable: 'DAT_RelicSynthesizer', id: 'relic_synthesizer' },
  { asset: 'CRAFT_Supercomputer', buildable: 'DAT_Supercomputer', id: 'supercomputer' },
]

const crafterByAsset = new Map(sourceCrafters.map((record) => [record.Name, record]))
const buildableByAsset = new Map(sourceBuildables.map((record) => [record.Name, record]))
const powerConsumption = (buildable) =>
  buildable.Properties.ItemDetails?.find((detail) => detail.DetailTypeText?.Key === 'ConsumePower')?.FloatValue

const buildings = crafterConfiguration.map((configuration) => {
  const crafter = crafterByAsset.get(configuration.asset)
  const buildable = buildableByAsset.get(configuration.buildable)
  const recipes = recipesByCrafter.get(configuration.asset)
  if (!crafter || !buildable || !recipes) throw new Error(`Incomplete crafter configuration for ${configuration.asset}`)

  const power = powerConsumption(buildable)
  return {
    id: configuration.id,
    name: displayName(crafter),
    type: 'production',
    ...(power !== undefined ? { power } : {}),
    recipes,
  }
})

const recipes = buildings.flatMap((building) => building.recipes)
const recipeIds = new Set(recipes.map((recipe) => recipe.id))
if (recipeIds.size !== sourceRecipes.length) throw new Error('Generated recipe IDs are not unique')

for (const recipe of recipes) {
  for (const amount of [recipe.output, ...recipe.inputs, ...(recipe.extra_outputs ?? [])]) {
    if (!itemIds.has(amount.id)) throw new Error(`${recipe.id} references missing item ${amount.id}`)
  }
}

const researchTypeIds = {
  DAT_AlienTechnology: 'alien_technology',
  DAT_AstronomyScience: 'astronomy_science',
  DAT_ComputationScience: 'computation_science',
  DAT_ElectromagneticScience: 'electromagnetic_science',
  DAT_MaterialScience: 'material_science',
  DAT_QuantumScience: 'quantum_science',
  DAT_XenobiologyScience: 'xenobiology_science',
}

const branches = Object.fromEntries(
  sourceResearchTypes.map((record) => {
    const id = researchTypeIds[record.Name]
    if (!id) throw new Error(`Missing stable research branch ID for ${record.Name}`)

    return [
      displayName(record),
      {
        id,
        components: record.Properties.ResearchItems.map((reference) => {
          const itemAsset = referenceId(reference)
          const item = itemRecordByAsset.get(itemAsset)
          if (!item || item.Properties.ResearchValue === undefined) throw new Error(`Missing research value for ${itemAsset}`)
          if (referenceId(item.Properties.ResearchType) !== record.Name)
            throw new Error(`${itemAsset} references the wrong research branch`)
          return { id: itemId(item), points: item.Properties.ResearchValue }
        }),
        technologies: [],
      },
    ]
  }),
)

branches.General = {
  id: 'general',
  components: [],
  technologies: [],
}

const branchByAsset = new Map(sourceResearchTypes.map((record) => [record.Name, branches[displayName(record)]]))
const recipeNameByAsset = new Map(
  sourceRecipes.map((record) => {
    const outputAsset = referenceId(record.Properties.Output.Item)
    const outputItem = itemRecordByAsset.get(outputAsset)
    return [record.Name, outputItem ? displayName(outputItem) : titleCase(record.Name)]
  }),
)

const mapReward = (unlock) => {
  const type = unlock.UnlockType.replace('EUnlockType::', '').toLowerCase()
  const reference = type === 'recipe' ? unlock.Recipe : type === 'buildable' ? unlock.Buildable : type === 'block' ? unlock.bLock : null
  const asset = referenceId(reference)
  if (!asset) throw new Error(`Unsupported research unlock: ${JSON.stringify(unlock)}`)

  if (type === 'recipe') {
    const id = recipeIdByAsset.get(asset)
    if (!id) throw new Error(`Missing recipe reward ${asset}`)
    return { id, name: recipeNameByAsset.get(asset) ?? titleCase(asset), type }
  }

  if (type === 'buildable') {
    const buildable = buildableByAsset.get(asset)
    if (!buildable) throw new Error(`Missing buildable reward ${asset}`)
    return { id: asset, name: displayName(buildable), type }
  }

  return { id: asset, name: titleCase(asset), type }
}

const mapTechnology = (record, xp) => {
  const primaryPrerequisite = referenceId(record.Properties.PrimaryPrerequisite)
  const prerequisites = [...new Set((record.Properties.Prerequisites ?? []).map(referenceId).filter(Boolean))].filter(
    (requirement) => requirement !== primaryPrerequisite,
  )
  const icon = referenceId(record.Properties.Icon)

  return {
    id: record.Name,
    name: displayName(record),
    ...(icon ? { icon } : {}),
    xp,
    ...(record.Properties.bStartUnlocked ? { start_unlocked: true } : {}),
    ...(primaryPrerequisite ? { primary_prerequisite: primaryPrerequisite } : {}),
    ...(prerequisites.length ? { prerequisites } : {}),
    rewards: record.Properties.Unlocks.map(mapReward),
  }
}

for (const record of sourceResearch) {
  const costs = record.Properties.RequiredResearch ?? []
  if (costs.length === 0) {
    branches.General.technologies.push(mapTechnology(record, 0))
    continue
  }

  for (const cost of costs) {
    const researchTypeAsset = referenceId(cost.ResearchType)
    const branch = branchByAsset.get(researchTypeAsset)
    if (!branch) throw new Error(`${record.Name} references missing research branch ${researchTypeAsset}`)
    branch.technologies.push(mapTechnology(record, cost.Amount))
  }
}

const technologyIds = new Set(sourceResearch.map((record) => record.Name))
for (const branch of Object.values(branches)) {
  for (const component of branch.components) {
    if (!itemIds.has(component.id)) throw new Error(`${branch.id} references missing research item ${component.id}`)
  }

  for (const technology of branch.technologies) {
    for (const requirement of [technology.primary_prerequisite, ...(technology.prerequisites ?? [])].filter(Boolean)) {
      if (!technologyIds.has(requirement)) throw new Error(`${technology.id} references missing prerequisite ${requirement}`)
    }

    for (const reward of technology.rewards) {
      if (reward.type === 'recipe' && !recipeIds.has(reward.id)) {
        throw new Error(`${technology.id} references missing recipe ${reward.id}`)
      }
    }
  }
}

mkdirSync(outputRoot, { recursive: true })

const prettierOptions = (await resolveConfig(join(projectRoot, 'package.json'))) ?? {}
const writeJson = async (name, value) => {
  const json = await format(JSON.stringify(value), { ...prettierOptions, parser: 'json' })
  writeFileSync(join(outputRoot, name), json)
}

await Promise.all([
  writeJson('items.json', items),
  writeJson('buildings_and_recipes.json', buildings),
  writeJson('research.json', branches),
])

const availableIconIds = new Set()
for (const kind of ['items', 'buildings']) {
  const directory = join(publicIconRoot, kind)
  if (!existsSync(directory)) continue
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.webp')) availableIconIds.add(basename(entry.name, '.webp'))
  }
}

const missingItemIcons = catalogItemRecords
  .map((record) => ({ item: record.Name, icon: referenceId(record.Properties.Icon), sourcePath: record.Properties.Icon.ObjectPath }))
  .filter((item) => !availableIconIds.has(item.icon))

const missingBuildingIcons = crafterConfiguration
  .map((configuration) => {
    const buildable = buildableByAsset.get(configuration.buildable)
    return {
      building: configuration.id,
      icon: referenceId(buildable.Properties.Icon),
      sourcePath: buildable.Properties.Icon.ObjectPath,
    }
  })
  .filter((building) => !availableIconIds.has(building.icon))

mkdirSync(publicResearchIconRoot, { recursive: true })
const missingResearchIcons = []
const copiedResearchIcons = new Set()
for (const record of sourceResearch) {
  const icon = referenceId(record.Properties.Icon)
  const relativeSourcePath = record.Properties.Icon?.ObjectPath?.replace('/Game/', '').replace(/\.\d+$/, '')
  const sourceCandidates = relativeSourcePath ? ['.webp', '.png'].map((extension) => join(sourceRoot, relativeSourcePath + extension)) : []
  const sourceIcon = sourceCandidates.find(existsSync)

  if (!icon || !sourceIcon) {
    missingResearchIcons.push({ technology: record.Name, icon, sourcePath: record.Properties.Icon?.ObjectPath })
    continue
  }

  const extension = sourceIcon.endsWith('.png') ? '.png' : '.webp'
  copyFileSync(sourceIcon, join(publicResearchIconRoot, icon + extension))
  copiedResearchIcons.add(icon)
}

console.log(
  JSON.stringify(
    {
      items: items.length,
      buildings: buildings.length,
      recipes: recipes.length,
      researchBranches: Object.keys(branches).length,
      uniqueTechnologies: new Set(Object.values(branches).flatMap((branch) => branch.technologies.map((technology) => technology.id))).size,
      missingItemIcons,
      missingBuildingIcons,
      copiedResearchIcons: copiedResearchIcons.size,
      missingResearchIcons,
    },
    null,
    2,
  ),
)
