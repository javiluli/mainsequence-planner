import { Factory, FlaskConical, Package, Waypoints } from 'lucide-react'
import type { ComponentType } from 'react'

export const ROUTE = {
  HOME: '/',
  ITEMS: '/items',
  RECIPES: '/recipes',
  RESEARCH: '/research',
}

interface PrimaryNavigationItem {
  path: string
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  label: string
}

export const PRIMARY_NAVIGATION: PrimaryNavigationItem[] = [
  { path: ROUTE.HOME, icon: Waypoints, label: 'Planner' },
  { path: ROUTE.ITEMS, icon: Package, label: 'Items' },
  { path: ROUTE.RECIPES, icon: Factory, label: 'Buildings' },
  { path: ROUTE.RESEARCH, icon: FlaskConical, label: 'Research' },
]
