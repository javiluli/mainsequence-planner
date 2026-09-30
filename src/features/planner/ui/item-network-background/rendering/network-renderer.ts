import { drawLinks } from './links'
import { drawNodes } from './nodes'
import { drawBackImpacts, drawFrontImpacts } from './impacts'
import type { NetworkRenderOptions } from './render.types'

/** Layer order keeps the corona behind the body and the contact light above it. */
export const renderNetwork = (options: NetworkRenderOptions) => {
  drawLinks(options)
  drawBackImpacts(options)
  drawNodes(options)
  drawFrontImpacts(options)
}
