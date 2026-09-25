import { ROUTE } from '@/router/routes'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_URL = 'https://mainsequence-planner.vercel.app'

const ROUTE_METADATA = {
  [ROUTE.HOME]: {
    title: 'Main Sequence Planner — Production Calculator',
    description:
      'Production planner and calculator for Main Sequence. Plan production chains, machines, resources, items, recipes, and research.',
  },
  [ROUTE.ITEMS]: {
    title: 'Main Sequence Items & Resources — Main Sequence Planner',
    description:
      'Browse Main Sequence items and resources, filter the production catalog, and open any item directly in the production planner.',
  },
  [ROUTE.RECIPES]: {
    title: 'Main Sequence Buildings & Recipes — Main Sequence Planner',
    description:
      'Browse Main Sequence buildings, machines, and recipes, including production inputs, outputs, and crafting relationships.',
  },
  [ROUTE.RESEARCH]: {
    title: 'Main Sequence Research Tree — Main Sequence Planner',
    description:
      'Explore the Main Sequence research tree, technologies, prerequisites, science costs, progression paths, and unlock relationships.',
  },
} as const

const NOT_FOUND_METADATA = {
  title: 'Page Not Found — Main Sequence Planner',
  description: 'The requested address does not match any page in Main Sequence Planner.',
}

export const RouteSeo = () => {
  const { pathname } = useLocation()
  const isIndexable = Object.hasOwn(ROUTE_METADATA, pathname)
  const metadata = isIndexable ? ROUTE_METADATA[pathname as keyof typeof ROUTE_METADATA] : NOT_FOUND_METADATA

  useEffect(() => {
    document.title = metadata.title
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', metadata.description)
  }, [metadata.description, metadata.title])

  return isIndexable ? (
    <link rel="canonical" href={new URL(pathname, SITE_URL).toString()} />
  ) : (
    <meta name="robots" content="noindex, nofollow" />
  )
}
