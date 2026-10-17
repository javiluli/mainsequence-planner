export type IconKind = 'items' | 'buildings'

/** Texture filenames are presentation metadata; gameplay IDs must remain unique and unchanged. */
const itemIconAliases: Readonly<Record<string, string>> = {
  T_ContainmentCoil: 'T_ContainmentCoil1',
  backpack_mk2: 'T_Backpack_1',
  backpack_mk3: 'T_Backpack_1',
  exoskeleton_mk2: 'T_Exoskeleton_1',
  exoskeleton_mk3: 'T_Exoskeleton_1',
  repair_kit_electric: 'T_RepairKit',
  repair_kit_hull: 'T_RepairKit',
}

/** Planner machine IDs map to the verified texture filenames exported from the game. */
const buildingIconAliases: Readonly<Record<string, string>> = {
  advanced_assembler: 'T_AdvancedAssembler1',
  armoury: 'T_Armoury',
  refinery: 'T_Refinery',
  fabricator: 'T_Assembler',
  enrichment: 'T_EnrichmentChamber2',
  growth_chamber: 'T_GrowthChamber1',
  relic_synthesizer: 'T_RelicSynthesizer',
  supercomputer: 'T_Supercomputer',
}

/** Resolves a gameplay ID to its exported texture without changing the gameplay identity. */
export const getIconSource = (kind: IconKind, id: string): string | null => {
  const alias = kind === 'items' ? itemIconAliases[id] : buildingIconAliases[id]
  return `${import.meta.env.BASE_URL}assets/icons/${kind}/${alias ?? id}.webp`
}
