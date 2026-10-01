import { getIconSource } from '@/shared/ui/asset-image/icon-source'

/** Image callbacks and references have the same lifetime as the canvas that uses them. */
export class ItemImageCache {
  private readonly images = new Map<string, HTMLImageElement | null>()
  private readonly invalidate: () => void

  constructor(invalidate: () => void) {
    this.invalidate = invalidate
  }

  public readonly get = (itemId: string): HTMLImageElement | null => {
    if (this.images.has(itemId)) return this.images.get(itemId) ?? null
    const source = getIconSource('items', itemId)
    if (!source) {
      this.images.set(itemId, null)
      return null
    }
    const image = new Image()
    image.decoding = 'async'
    image.onload = this.invalidate
    image.onerror = this.invalidate
    this.images.set(itemId, image)
    image.src = source
    return image
  }

  public clear() {
    for (const image of this.images.values()) {
      if (image) image.onload = image.onerror = null
    }
    this.images.clear()
  }
}
