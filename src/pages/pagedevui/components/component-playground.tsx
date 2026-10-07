import { Panel, Typography } from '@/shared/ui'
import type { ReactNode } from 'react'

interface Props {
  id: string
  title: string
  children: ReactNode
}

export const ComponentPlayground = ({ id, title, children }: Props) => (
  <Panel as="section" id={id} variant="muted" padding="lg" className="scroll-mt-4 space-y-4">
    <Typography variant="h3">{title}</Typography>
    <div className="space-y-6">{children}</div>
  </Panel>
)
