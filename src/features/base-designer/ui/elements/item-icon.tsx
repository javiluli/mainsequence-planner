import { useEffect, useState, type ReactNode } from 'react'
import { Group, Image } from 'react-konva'
import { getIconSource } from '@/shared/ui/asset-image'

// Repeated machines and their previews share the same decoded catalog texture.
const textures = new Map<string, Promise<HTMLImageElement | null>>()

/** Load one static item texture; failed requests are retryable on a later mount. */
function itemTexture(id: string): Promise<HTMLImageElement | null> {
  const cached = textures.get(id)
  if (cached) return cached
  const source = getIconSource('items', id)
  if (!source) return Promise.resolve(null)
  const pending = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      textures.delete(id)
      resolve(null)
    }
    image.src = source
  })
  textures.set(id, pending)
  return pending
}

/** Centered, non-interactive catalog icon shared by recipe machines, drone cargos and previews. */
export function ItemIcon({
  id,
  size,
  x = 0,
  y = 0,
  rotation = 0,
  children,
}: {
  id: string | null
  size: number
  x?: number
  y?: number
  rotation?: number
  children?: ReactNode
}) {
  const [resource, setResource] = useState<{ id: string; image: HTMLImageElement } | null>(null)
  useEffect(() => {
    if (!id) return
    let active = true
    void itemTexture(id).then((image) => {
      if (active && image) setResource({ id, image })
    })
    return () => {
      active = false
    }
  }, [id])
  const image = resource?.id === id ? resource.image : null
  return (
    <Group x={x} y={y} rotation={rotation} listening={false}>
      {image ? <Image name="item-icon" itemId={id} image={image} x={-size / 2} y={-size / 2} width={size} height={size} /> : children}
    </Group>
  )
}
