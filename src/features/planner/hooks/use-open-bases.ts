import { useNavigate } from 'react-router-dom'
import { usePlannerTarget } from './use-planner-target'

/** Shares the selected production target with the informational Bases comparison. */
export const useOpenBases = () => {
  const navigate = useNavigate()
  const { selectTargetItem } = usePlannerTarget()

  return (itemId: string) => {
    selectTargetItem(itemId)
    navigate('/bases')
  }
}
