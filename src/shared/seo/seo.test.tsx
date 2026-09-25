/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Seo } from './seo'

const installSeoShell = () => {
  document.head.innerHTML = `
    <meta id="seo-description" name="description" content="" />
    <meta id="seo-robots" name="robots" content="" />
    <link id="seo-canonical" rel="canonical" href="" />
    <meta id="seo-og-title" property="og:title" content="" />
    <meta id="seo-og-description" property="og:description" content="" />
    <meta id="seo-og-url" property="og:url" content="" />
    <meta id="seo-twitter-title" name="twitter:title" content="" />
    <meta id="seo-twitter-description" name="twitter:description" content="" />
    <script id="seo-structured-data" type="application/ld+json"></script>
  `
}

afterEach(() => {
  cleanup()
  document.head.innerHTML = ''
})

describe('Seo', () => {
  it('updates the document metadata for an indexable route', async () => {
    installSeoShell()

    render(<Seo title="Items — Main Sequence Planner" description="Browse Main Sequence items." path="/items" />)

    await waitFor(() => expect(document.title).toBe('Items — Main Sequence Planner'))

    expect(document.getElementById('seo-description')).toHaveAttribute('content', 'Browse Main Sequence items.')
    expect(document.getElementById('seo-robots')).toHaveAttribute('content', 'index, follow')
    expect(document.getElementById('seo-canonical')).toHaveAttribute('href', 'https://mainsequence-planner.vercel.app/items')
    expect(document.getElementById('seo-og-url')).toHaveAttribute('content', 'https://mainsequence-planner.vercel.app/items')

    const structuredData = JSON.parse(document.getElementById('seo-structured-data')?.textContent ?? '{}') as {
      name?: string
      url?: string
    }

    expect(structuredData.name).toBe('Main Sequence Planner')
    expect(structuredData.url).toBe('https://mainsequence-planner.vercel.app/items')
  })

  it('marks non-indexable routes with noindex', async () => {
    installSeoShell()

    render(<Seo title="Page not found" description="Not found." path="/missing" indexable={false} />)

    await waitFor(() => expect(document.getElementById('seo-robots')).toHaveAttribute('content', 'noindex, nofollow'))
  })
})
