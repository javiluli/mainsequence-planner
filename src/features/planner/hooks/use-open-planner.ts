import { useNavigate } from 'react-router-dom'
import { usePlannerTarget } from './use-planner-target'

/**
 * Opens Planner with its target preset; an exact recipe replaces only that item's saved choice.
 * @returns A shortcut accepting an item ID and optional recipe ID; invalid explicit recipes do not change state or navigate.
 */
export const useOpenPlanner = () => {
  const navigate = useNavigate()
  const { selectTargetItem } = usePlannerTarget()

  return (itemId: string, recipeId?: string) => {
    if (!selectTargetItem(itemId, recipeId)) return false
    navigate('/')
    return true
  }
}
