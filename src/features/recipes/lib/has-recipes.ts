import type { Building } from '@/shared/@types/building.type'

export const hasRecipes = (building: Building) => building.recipes.length > 0
