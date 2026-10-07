import { cn } from '@heroui/react'

import type { PanelProps } from './panel'
import { Panel } from './panel'

export type PageHeaderProps = Omit<PanelProps<'header'>, 'as'>

/** Shared page header surface. Keeps page-level spacing and depth consistent. */
export const PageHeader = ({ children, className, ...props }: PageHeaderProps) => (
  <Panel as="header" padding="sm" className={cn('shrink-0', className)} {...props}>
    {children}
  </Panel>
)
