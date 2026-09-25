import { useEffect } from 'react'

export const SITE_URL = 'https://mainsequence-planner.vercel.app'

const SITE_NAME = 'Main Sequence Planner'
const SOCIAL_IMAGE_URL = `${SITE_URL}/assets/icons/items/T_AdvancedCircuit.webp`

interface SeoProps {
  title: string
  description: string
  path: string
  indexable?: boolean
}

const setContentAttribute = (id: string, content: string) => {
  document.getElementById(id)?.setAttribute('content', content)
}

export const Seo = ({ title, description, path, indexable = true }: SeoProps) => {
  useEffect(() => {
    const canonicalUrl = new URL(path, SITE_URL).toString()
    const robots = indexable ? 'index, follow' : 'noindex, nofollow'

    document.title = title
    setContentAttribute('seo-description', description)
    setContentAttribute('seo-robots', robots)
    document.getElementById('seo-canonical')?.setAttribute('href', canonicalUrl)
    setContentAttribute('seo-og-title', title)
    setContentAttribute('seo-og-description', description)
    setContentAttribute('seo-og-url', canonicalUrl)
    setContentAttribute('seo-twitter-title', title)
    setContentAttribute('seo-twitter-description', description)

    const structuredDataElement = document.getElementById('seo-structured-data')
    if (structuredDataElement) {
      structuredDataElement.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        isAccessibleForFree: true,
        description,
        url: canonicalUrl,
        image: SOCIAL_IMAGE_URL,
      })
    }
  }, [description, indexable, path, title])

  return null
}
