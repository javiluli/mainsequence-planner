import { cn, Image, Skeleton } from '@heroui/react'
import { useCallback, useState } from 'react'
import { getIconSource, type IconKind } from './icon-source'

export type { IconKind } from './icon-source'

type AssetImageProps = {
  id: string
  kind: IconKind
  width?: number
  alt?: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
  className?: string
}

type ImageLoadState = 'loading' | 'loaded' | 'error'

const AssetImageResource = ({ id, kind, width, alt, loading = 'lazy', fetchPriority = 'auto', className }: AssetImageProps) => {
  const source = getIconSource(kind, id)
  const [loadState, setLoadState] = useState<ImageLoadState>(source ? 'loading' : 'error')
  const isLoaded = loadState === 'loaded'

  const bindImageEvents = useCallback((image: HTMLImageElement | null) => {
    if (!image) return

    const handleLoad = () => setLoadState('loaded')
    const handleError = () => setLoadState('error')

    image.addEventListener('load', handleLoad)
    image.addEventListener('error', handleError)

    // Cached images may already be complete before the ref callback runs.
    if (image.complete && image.naturalWidth > 0) handleLoad()

    return () => {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
    }
  }, [])

  return (
    <span
      aria-busy={loadState === 'loading'}
      data-load-state={loadState}
      className={cn('relative inline-flex shrink-0 overflow-hidden align-middle', className)}
      style={{ width, height: width }}
    >
      {loadState === 'loading' && (
        <Skeleton data-testid="asset-image-placeholder" aria-hidden className="absolute inset-0 h-full w-full rounded-md bg-content2" />
      )}

      {loadState === 'error' && (
        <span data-testid="asset-image-fallback" aria-hidden className="absolute inset-0 rounded-md bg-content2/60" />
      )}

      {source && (
        <Image
          ref={bindImageEvents}
          as="img"
          removeWrapper
          alt={alt ?? id.replaceAll('_', ' ')}
          src={source}
          width={width}
          height={width}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          className={cn('h-full w-full rounded-none object-contain', loading === 'lazy' && 'transition-opacity duration-200')}
          style={{ opacity: isLoaded ? 1 : 0 }}
        />
      )}
    </span>
  )
}

/** The resource key resets loading state when either catalog identity changes. */
export const AssetImage = (props: AssetImageProps) => <AssetImageResource key={`${props.kind}:${props.id}`} {...props} />
