import { useNavigate } from 'react-router-dom'
import { usePlannerTarget } from './use-planner-target'

/** Selects a target and opens the planner without delaying the route transition. */
export const useOpenPlanner = () => {
  const navigate = useNavigate()
  const { selectTargetItem } = usePlannerTarget()

  return (itemId: string) => {
    selectTargetItem(itemId)
    navigate('/')
  }
}
