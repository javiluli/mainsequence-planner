import { useMemo } from 'react'
import type { ProductionPlan } from '../../../lib'
import { buildTree } from '../lib/tree-build'

/** Memoizes the tree projection of the same confirmed plan used by the other Planner views. */
export const useTreeData = (plan: ProductionPlan | null) => useMemo(() => (plan ? buildTree(plan) : null), [plan])
