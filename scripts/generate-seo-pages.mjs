import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const DIST_DIR = resolve('dist')
const SITE_URL = 'https://mainsequence-planner.vercel.app'
const SOCIAL_IMAGE_URL = `${SITE_URL}/assets/icons/items/T_AdvancedCircuit.webp`

const routes = [
  {
    path: '/',
    output: 'index.html',
    title: 'Main Sequence Planner — Production Calculator',
    description:
      'Plan Main Sequence production chains, calculate required machines and resources, and browse items, buildings, recipes, and research.',
  },
  {
    path: '/items',
    output: 'items.html',
    title: 'Main Sequence Items & Resources — Planner',
    description:
      'Browse Main Sequence items and resources, filter the production catalog, and open any item directly in the production planner.',
  },
  {
    path: '/recipes',
    output: 'recipes.html',
    title: 'Main Sequence Buildings & Recipes — Planner',
    description:
      'Browse Main Sequence buildings, machines, and recipes, including production inputs, outputs, and available crafting relationships.',
  },
  {
    path: '/research',
    output: 'research.html',
    title: 'Main Sequence Research Tree — Planner',
    description:
      'Explore the Main Sequence research tree, technologies, prerequisites, science costs, progression paths, and unlock relationships.',
  },
]

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const replaceTagById = (html, id, replacement) => {
  const pattern = new RegExp(`<[^>]+id="${id}"[^>]*>`, 'u')
  if (!pattern.test(html)) {
    throw new Error(`SEO shell tag #${id} was not found in dist/index.html`)
  }

  return html.replace(pattern, replacement)
}

const replaceStructuredData = (html, structuredData) => {
  const pattern = /<script[^>]*id="seo-structured-data"[^>]*>[\s\S]*?<\/script>/u
  if (!pattern.test(html)) {
    throw new Error('SEO structured data shell was not found in dist/index.html')
  }

  const json = JSON.stringify(structuredData).replaceAll('<', '\\u003c')
  return html.replace(pattern, `<script id="seo-structured-data" type="application/ld+json">${json}</script>`)
}

const renderRoute = (sourceHtml, route) => {
  const canonicalUrl = new URL(route.path, SITE_URL).toString()
  let html = sourceHtml.replace(/<title>[\s\S]*?<\/title>/u, `<title>${escapeHtml(route.title)}</title>`)

  html = replaceTagById(
    html,
    'seo-description',
    `<meta id="seo-description" name="description" content="${escapeHtml(route.description)}" />`,
  )
  html = replaceTagById(html, 'seo-robots', '<meta id="seo-robots" name="robots" content="index, follow" />')
  html = replaceTagById(
    html,
    'seo-canonical',
    `<link id="seo-canonical" rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  )
  html = replaceTagById(
    html,
    'seo-og-title',
    `<meta id="seo-og-title" property="og:title" content="${escapeHtml(route.title)}" />`,
  )
  html = replaceTagById(
    html,
    'seo-og-description',
    `<meta id="seo-og-description" property="og:description" content="${escapeHtml(route.description)}" />`,
  )
  html = replaceTagById(
    html,
    'seo-og-url',
    `<meta id="seo-og-url" property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
  )
  html = replaceTagById(
    html,
    'seo-twitter-title',
    `<meta id="seo-twitter-title" name="twitter:title" content="${escapeHtml(route.title)}" />`,
  )
  html = replaceTagById(
    html,
    'seo-twitter-description',
    `<meta id="seo-twitter-description" name="twitter:description" content="${escapeHtml(route.description)}" />`,
  )

  return replaceStructuredData(html, {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Main Sequence Planner',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    description: route.description,
    url: canonicalUrl,
    image: SOCIAL_IMAGE_URL,
  })
}

const sourceHtml = await readFile(resolve(DIST_DIR, 'index.html'), 'utf8')

await Promise.all(
  routes.map(async (route) => {
    const html = renderRoute(sourceHtml, route)
    await writeFile(resolve(DIST_DIR, route.output), html, 'utf8')
  }),
)
