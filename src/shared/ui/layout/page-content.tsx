import { cn } from '@heroui/react'
import { Panel, type PanelProps, type PanelVariant } from './panel'

type PageContentOverflow = 'auto' | 'hidden' | 'visible'
type PageContentSurface = Exclude<PanelVariant, 'plain'>

export type PageContentProps = Omit<PanelProps<'section'>, 'as' | 'variant'> & {
  overflow?: PageContentOverflow
  surface?: PageContentSurface
}

const overflowClasses: Record<PageContentOverflow, string> = {
  auto: 'overflow-auto',
  hidden: 'overflow-hidden',
  visible: 'overflow-visible',
}

/** Owns the remaining page space, its scroll boundary and its optional surface. */
export const PageContent = ({ children, className, overflow = 'auto', padding = 'none', surface, ...props }: PageContentProps) => (
  <Panel
    as="section"
    variant={surface ?? 'plain'}
    padding={padding}
    className={cn('min-h-0 min-w-0 flex-1', overflowClasses[overflow], className)}
    {...props}
  >
    {children}
  </Panel>
)
